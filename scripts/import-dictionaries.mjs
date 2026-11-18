import { mkdir, writeFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import { gunzipSync, unzipSync } from "fflate";

const RELEASE = "v1.3.0";
const BASE = `https://github.com/DanielGregorini/koreader-dicts/releases/download/${RELEASE}`;
const PAIRS = ["ar-en", "en-ar"];
const OUTPUT = join(process.cwd(), "build", "dictionaries");
const BUCKET = process.env.TARJUMAN_DICTIONARY_BUCKET || "tarjuman-dictionaries";
const upload = process.argv.includes("--upload");

function decodeHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<\/(?:p|div|li|dd|dt|h[1-6])\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function firstLetterKey(word) {
  const first = [...word.normalize("NFC").toLocaleLowerCase()][0] || "_";
  return first.codePointAt(0).toString(16);
}

function parseStarDict(pair, files) {
  const paths = Object.keys(files);
  const idxPath = paths.find(path => path.endsWith(`${pair}.idx`));
  const dictPath = paths.find(path => path.endsWith(`${pair}.dict.dz`));
  if (!idxPath || !dictPath) {
    throw new Error(`The ${pair}.zip archive is missing its .idx or .dict.dz file`);
  }

  const index = files[idxPath];
  const dictionary = gunzipSync(files[dictPath]);
  const decoder = new TextDecoder("utf-8");
  const view = new DataView(index.buffer, index.byteOffset, index.byteLength);
  const shards = new Map();
  let cursor = 0;
  let count = 0;

  while (cursor < index.length) {
    const start = cursor;
    while (cursor < index.length && index[cursor] !== 0) cursor++;
    if (cursor >= index.length || cursor + 9 > index.length) break;
    const word = decoder.decode(index.subarray(start, cursor)).trim().toLocaleLowerCase();
    cursor++;
    const offset = view.getUint32(cursor, false);
    const size = view.getUint32(cursor + 4, false);
    cursor += 8;
    if (!word || size === 0 || offset + size > dictionary.length) continue;

    const definition = decodeHtml(decoder.decode(dictionary.subarray(offset, offset + size)));
    if (!definition) continue;
    const shardKey = firstLetterKey(word);
    if (!shards.has(shardKey)) shards.set(shardKey, {});
    // Keep the original definition text: the Worker presents it to the model as
    // candidate meanings, never as an unconditional word-for-word replacement.
    shards.get(shardKey)[word] = definition.slice(0, 900);
    count++;
  }
  return { shards, count };
}

async function main() {
  await rm(OUTPUT, { recursive: true, force: true });
  let total = 0;
  for (const pair of PAIRS) {
    const response = await fetch(`${BASE}/${pair}.zip`);
    if (!response.ok) throw new Error(`Download ${pair}.zip failed: HTTP ${response.status}`);
    const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
    const parsed = parseStarDict(pair, archive);
    const pairDir = join(OUTPUT, pair);
    await mkdir(pairDir, { recursive: true });

    for (const [shard, entries] of parsed.shards) {
      const path = join(pairDir, shard + ".json");
      await writeFile(path, JSON.stringify(entries), "utf8");
      if (upload) {
        const key = `dictionary/v1/${pair}/${shard}.json`;
        execFileSync("npx", [
          "wrangler", "r2", "object", "put", `${BUCKET}/${key}`,
          `--file=${path}`, "--remote", "--content-type=application/json"
        ], { stdio: "inherit" });
      }
    }

    const notices = Object.entries(archive).filter(([path]) =>
      /(?:ATTRIBUTION|LICENSE|README\.txt)$/i.test(path)
    );
    for (const [noticePath, noticeBytes] of notices) {
      const name = basename(noticePath);
      const localPath = join(pairDir, name);
      await writeFile(localPath, noticeBytes);
      if (upload) {
        execFileSync("npx", [
          "wrangler", "r2", "object", "put",
          `${BUCKET}/dictionary/v1/${pair}/legal/${name}`,
          `--file=${localPath}`, "--remote", "--content-type=text/plain"
        ], { stdio: "inherit" });
      }
    }
    total += parsed.count;
    console.log(`${pair}: ${parsed.count.toLocaleString()} entries in ${parsed.shards.size} shards`);
  }
  console.log(upload
    ? `Uploaded ${total.toLocaleString()} dictionary entries to R2 bucket ${BUCKET}.`
    : `Prepared ${total.toLocaleString()} entries. Re-run with --upload after creating the R2 bucket and binding.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
