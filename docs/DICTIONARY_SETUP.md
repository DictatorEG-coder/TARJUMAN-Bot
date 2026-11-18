# TARJUMAN dictionary storage

TARJUMAN now supports large, versioned bilingual dictionary shards in Cloudflare R2. The Worker reads only the shards needed by a translation request and supplies their entries to Gemini as **contextual candidate meanings**. It never blindly replaces words, because a dictionary entry can have several senses and grammar depends on the sentence.

## First dictionary release

The first import uses the open KOReader StarDict builds:

| Pair | Entries | License |
|---|---:|---|
| Arabic → English (`ar-en`) | 28,892 | CC BY-SA 4.0 |
| English → Arabic (`en-ar`) | 155,624 | CC BY-SA 4.0 |

Source: [koreader-dicts v1.3.0](https://github.com/DanielGregorini/koreader-dicts/releases/tag/v1.3.0). The dictionaries combine Arabic WordNet, Princeton WordNet and English Wiktionary-derived data. Keep the original `ATTRIBUTION` and license notices generated beside each imported pair. The upstream project documents the source composition and coverage at [Arabic → English](https://danielgregorini.github.io/koreader-dicts/en/ar-en/) and [English → Arabic](https://danielgregorini.github.io/koreader-dicts/en/en-ar/).

The packs are lexical resources, not sentence-translation models. M2M100 remains the primary sentence engine. Gemini receives dictionary candidates when it is used as a fallback or optional reviewer. Exact high-confidence sentences continue to use `data/phrasebook.json`.

## One-time Cloudflare setup

1. Install the project dependencies: `npm install`.
2. Create the R2 bucket: `npx wrangler r2 bucket create tarjuman-dictionaries`.
3. Confirm `wrangler.toml` contains the `TRANSLATION_DICTIONARIES` R2 binding.
4. Download, convert and upload the dictionaries: `npm run upload:dictionaries`.
5. Deploy the Worker: `npm run deploy`.

To prepare local shards without uploading, run `npm run import:dictionaries`. Generated files are written under `build/dictionaries/` and are ignored by Git.

The import script downloads the pinned v1.3.0 release, parses the StarDict index and compressed definition data, and creates small JSON shards by first Unicode character. The Worker reads objects from:

`dictionary/v1/{source-target}/{first-letter-codepoint-hex}.json`

No dictionary archive or multi-megabyte JSON file is bundled into the Worker.

## Runtime behavior and limitations

- R2 lookups are skipped safely when the binding is not configured or a pair is not imported.
- The first release provides large Arabic↔English lexical support. Other language pairs continue using the existing phrase memory and translation engines until separately licensed packs are selected.
- Dictionary definitions are passed as contextual hints; they are not presented as guaranteed translations.
- The primary M2M100 engine does not accept a glossary parameter. Dictionary hints therefore currently improve Gemini fallback and optional Gemini review, while M2M100 remains unchanged.
- R2 shard results are cached in the Worker isolate to reduce repeat reads.
- Do not upload full dictionary ZIPs or corpus dumps to Git; keep generated packs in R2.

## License and attribution

The imported Arabic↔English dictionaries are distributed under CC BY-SA 4.0. Preserve the upstream attribution and license files. Any modified or redistributed dictionary data must continue to satisfy the applicable attribution and share-alike terms. The importer intentionally pins a release rather than silently following a moving branch.
