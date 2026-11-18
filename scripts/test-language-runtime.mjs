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
  source + "\nreturn { parseCommand, removeCommandPrefix, normalizeArabicColloquial, expandChatAbbreviations, detectAbbreviationSourceCode, quickPhraseTranslation, detectSourceCode, assertKeyMeaningMarkersPreserved, isStandaloneTarjumanCall, TARJUMAN_BANTER_REPLIES, getDictionaryGlossaryHints };"
);
const runtime = load(phrasebook, chatAbbreviations, arabicDialect);

assert.equal(runtime.isStandaloneTarjumanCall("ترجمان"), true);
assert.equal(runtime.isStandaloneTarjumanCall(" ترجمان! "), true);
assert.equal(runtime.isStandaloneTarjumanCall("ترجمان من فضلك"), false);
assert.equal(runtime.isStandaloneTarjumanCall("ترجم للإنجليزية ترجمان"), false);
assert.ok(runtime.TARJUMAN_BANTER_REPLIES.length >= 12);
assert.ok(runtime.TARJUMAN_BANTER_REPLIES.every(reply => typeof reply === "string" && reply.length > 8));

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
assert.equal(runtime.normalizeArabicColloquial("معلش اتأخرت عليك عشان الطريق كان زحم"), "أعتذر لأنني تأخرت عليك بسبب الازدحام المروري");
assert.equal(runtime.quickPhraseTranslation("معلش اتأخرت عليك عشان الطريق كان زحم", "en"), "Sorry to keep you waiting because the traffic was so heavy.");
assert.throws(() => runtime.assertKeyMeaningMarkersPreserved(
  "معلش اتأخرت عليك عشان الطريق كان زحم", "I apologize for being late because the road was dull.", "en"
), /traffic/i);
assert.equal(runtime.assertKeyMeaningMarkersPreserved(
  "معلش اتأخرت عليك عشان الطريق كان زحم", "Sorry to keep you waiting because the traffic was so heavy.", "en"
), undefined);
assert.equal(runtime.quickPhraseTranslation("مش هقدر أجي النهارده بسبب الزحمة", "en"), "I won't be able to come today because of the traffic.");

assert.equal(runtime.detectAbbreviationSourceCode("MDR"), "fr");
assert.equal(runtime.expandChatAbbreviations("MDR", "fr"), "mort de rire");
assert.equal(runtime.quickPhraseTranslation("mort de rire, je ne sais pas", "ar", "fr"), "أموت من الضحك، لا أعرف.");
assert.equal(runtime.detectAbbreviationSourceCode("СПС"), "ru");
assert.equal(runtime.expandChatAbbreviations("СПС", "ru"), "спасибо");
assert.equal(runtime.detectSourceCode("ДЯК"), "uk");
assert.equal(runtime.expandChatAbbreviations("ДЯК", "uk"), "дякую");
assert.equal(runtime.expandChatAbbreviations("XFA", "es"), "por favor");
assert.throws(() => runtime.assertKeyMeaningMarkersPreserved(
  "معلش اتأخرت عليك عشان الطريق كان زحمة", "I was late.", "en"
), /apology|traffic|cause/i);
assert.equal(runtime.assertKeyMeaningMarkersPreserved(
  "معلش اتأخرت عليك عشان الطريق كان زحمة",
  "Sorry to keep you waiting. There was a lot of traffic because of the congestion.",
  "en"
), undefined);
assert.throws(() => runtime.assertKeyMeaningMarkersPreserved(
  "لم أستطع الحضور أمس بسبب اجتماع طارئ", "I attended yesterday because of an emergency meeting.", "en"
), /negation/i);

const slovenian = "ترجم V francoščini: Dobro jutro, kako si?";
const slovenianParsed = runtime.parseCommand(slovenian);
assert.equal(slovenianParsed.target, "fr");
assert.equal(runtime.removeCommandPrefix(slovenian, slovenianParsed), "Dobro jutro, kako si?");
assert.equal(runtime.detectSourceCode("Dobro jutro, kako si?"), "sl");
assert.equal(runtime.quickPhraseTranslation("Dobro jutro, kako si?", "fr"), "Bonjour, comment vas-tu ?");

const englishCommand = "Translate to French: I will call you later";
const englishParsed = runtime.parseCommand(englishCommand);
assert.equal(englishParsed.target, "fr");
assert.equal(runtime.removeCommandPrefix(englishCommand, englishParsed), "I will call you later");

const nativeChinese = "ترجم 中文 你好";
assert.equal(runtime.parseCommand(nativeChinese).target, "zh-CN");

const dictionaryHints = await runtime.getDictionaryGlossaryHints("trust no one", "en", "ar", {
  TRANSLATION_DICTIONARIES: {
    async get(key) {
      assert.equal(key, "dictionary/v1/en-ar/74.json");
      return { async text() { return JSON.stringify({ trust: "confidence in the honesty of a person" }); } };
    }
  }
});
assert.match(dictionaryHints, /trust/);
assert.match(dictionaryHints, /confidence in the honesty/);
assert.equal(await runtime.getDictionaryGlossaryHints("trust", "en", "fr", {
  TRANSLATION_DICTIONARIES: { async get() { throw new Error("unsupported pair must not read R2"); } }
}), "");

console.log("Language runtime regression tests passed: abbreviations, dialect normalization, phrase memory, and multilingual command parsing.");
