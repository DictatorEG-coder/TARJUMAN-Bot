# TARJUMAN language resources

The Worker uses several small, complementary resources:

- `phrasebook.json`: exact, high-confidence sentence matches. It is checked before remote translation engines; it is not a general dictionary.
- `chat-abbreviations.json`: curated chat abbreviations. English, French, Spanish, German, Italian, Portuguese, and Turkish abbreviations are expanded before model translation when the source language is identified.
- `arabic-dialect.json`: conservative Egyptian/colloquial Arabic normalization pairs. Longer phrases are applied before shorter entries. Context-sensitive fillers such as `معلش`, `تمام`, and `خلاص` are deliberately preserved.

## Adding entries

1. Add only meanings that are stable in ordinary conversation.
2. Prefer phrase-level entries for idioms and expressions whose meaning changes by context.
3. Do not automatically replace ambiguous words or names.
4. Keep the source/target direction explicit in `phrasebook.json`.
5. Run `npm run test:data` before committing.

## Larger dictionaries and corpora

The files in this repository are curated runtime resources, not complete bilingual dictionaries or parallel corpora. Large Wiktionary, OPUS, or other corpus dumps should not be bundled into the Worker JavaScript package. A production-scale import requires a separately provisioned storage layer (Cloudflare R2/D1 or another indexed store), a data-import pipeline, language-pair indexing, attribution, and license review. The current Worker configuration has an AI binding and the existing user-settings KV only; it does not currently have a dictionary R2/D1 binding.

Do not import non-commercial-only resources into a product that may be used commercially without obtaining the appropriate permission.
