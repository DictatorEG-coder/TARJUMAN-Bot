import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const phrasebook = readJson("../data/phrasebook.json");
const chatAbbreviations = readJson("../data/chat-abbreviations.json");
const arabicDialect = readJson("../data/arabic-dialect.json");
let source = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
source = source
  .replace(/^import phrasebook from .*;\s*$/m, "")
  .replace(/^import chatAbbreviations from .*;\s*$/m, "")
  .replace(/^import arabicDialect from .*;\s*$/m, "")
  .replace("export default {", "const worker = {");
const load = new Function("phrasebook", "chatAbbreviations", "arabicDialect",
  source + "\nreturn { parseCommand, removeCommandPrefix, normalizeArabicColloquial, expandChatAbbreviations, detectAbbreviationSourceCode, quickPhraseTranslation, detectSourceCode };"
);
const runtime = load(phrasebook, chatAbbreviations, arabicDialect);

const brb = "BRB, I will talk to you later";
assert.equal(runtime.detectAbbreviationSourceCode(brb), "en");
const expandedBrb = runtime.expandChatAbbreviations(brb, "en");
assert.equal(expandedBrb, "be right back, I will talk to you later");
assert.equal(runtime.quickPhraseTranslation(expandedBrb, "fr", "en"), "Je reviens tout de suite. Je te parlerai plus tard.");

assert.equal(runtime.normalizeArabicColloquial("عامل ايه"), "كيف حالك");
assert.equal(
  runtime.normalizeArabicColloquial("معلش اتأخرت عليك عشان الطريق كان زحمة"),
  "أعتذر لأنني تأخرت عليك بسبب الازدحام المروري"
);
assert.equal(runtime.expandChatAbbreviations("معلش", "ar"), "معلش");

assert.equal(runtime.detectAbbreviationSourceCode("MDR"), "fr");
assert.equal(runtime.expandChatAbbreviations("MDR", "fr"), "mort de rire");
assert.equal(runtime.detectAbbreviationSourceCode("СПС"), "ru");
assert.equal(runtime.expandChatAbbreviations("СПС", "ru"), "спасибо");
assert.equal(runtime.detectSourceCode("ДЯК"), "uk");
assert.equal(runtime.expandChatAbbreviations("ДЯК", "uk"), "дякую");
assert.equal(runtime.expandChatAbbreviations("XFA", "es"), "por favor");

const slovenian = "ترجم V francoščini: Dobro jutro, kako si?";
const slovenianParsed = runtime.parseCommand(slovenian);
assert.equal(slovenianParsed.target, "fr");
assert.equal(runtime.removeCommandPrefix(slovenian, slovenianParsed), "Dobro jutro, kako si?");

const englishCommand = "Translate to French: I will call you later";
const englishParsed = runtime.parseCommand(englishCommand);
assert.equal(englishParsed.target, "fr");
assert.equal(runtime.removeCommandPrefix(englishCommand, englishParsed), "I will call you later");

const nativeChinese = "ترجم 中文 你好";
assert.equal(runtime.parseCommand(nativeChinese).target, "zh-CN");

console.log("Language runtime regression tests passed: abbreviations, dialect normalization, phrase memory, and multilingual command parsing.");
