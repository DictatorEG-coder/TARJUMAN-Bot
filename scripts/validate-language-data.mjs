import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const phrasebook=read("../data/phrasebook.json"), abbreviations=read("../data/chat-abbreviations.json"), dialect=read("../data/arabic-dialect.json");
assert.ok(phrasebook.ar?.fr && phrasebook.ar?.en && phrasebook.en?.fr && phrasebook.en?.ar);
for(const [source,targets] of Object.entries(phrasebook)) for(const [target,entries] of Object.entries(targets)) {
 assert.ok(entries && typeof entries==="object" && !Array.isArray(entries),source+"->"+target);
 for(const [input,output] of Object.entries(entries)) assert.ok(input.trim() && output.trim());
}
for(const key of ["BRB","ASAP","BTW","TTYL","IDK"]) assert.ok(abbreviations.en?.[key],"Missing "+key);
assert.ok(Object.keys(abbreviations.en||{}).length>=80);
assert.ok(Object.keys(dialect).length>=50);
for(const [input,output] of Object.entries(dialect)) assert.ok(input.trim()&&output.trim());
assert.equal(phrasebook.en.fr["brb, i will talk to you later"],"Je reviens tout de suite. Je te parlerai plus tard.");
console.log("Language data validation passed", {abbreviations:Object.keys(abbreviations.en).length,dialect:Object.keys(dialect).length});
