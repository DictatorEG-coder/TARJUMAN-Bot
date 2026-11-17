# Translation data resources

This folder tracks redistributable language resources considered for TARJUMAN. Large corpora are not loaded into each Worker request. They must be filtered, normalized, attributed, and stored in a suitable data service or used for offline evaluation/training.

## Resources reviewed

| Resource | Contents | License / caution | Intended use |
|---|---|---|---|
| [Tatoeba downloads](https://tatoeba.org/en/downloads) | Multilingual sentence pairs, including Arabic, Egyptian Arabic, English, French and many others; weekly exports | Sentence-level licenses vary; preserve attribution and each sentence's license metadata | Build curated parallel phrase memories and evaluate translation quality |
| [Kaikki / Wiktextract](https://kaikki.org/dictionary/) | Machine-readable Wiktionary dictionaries, definitions, inflections, senses and translations | Wiktionary data is CC BY-SA and GFDL; attribution and share-alike obligations apply. Raw all-language dump is multi-GB compressed and is not suitable for a Worker bundle | Offline dictionary ingestion; extract only required language pairs and fields |
| [Open Multilingual Wordnet](https://omwn.org/omw1.html) | Synsets and semantic relations across many languages; includes Arabic WordNet | Licenses differ by constituent WordNet; inspect the license of each sub-dataset before redistribution | Disambiguation and synonym/meaning support, not direct sentence translation |
| [Apertium](https://github.com/apertium) | Open bilingual lexical and morphological dictionaries for selected language pairs | Check the exact pair repository license; many packages use free-software licenses such as GPL | Specialized word/inflection fallback after license review |
| [Open bilingual dictionaries](https://danielgregorini.github.io/koreader-dicts/en/) | Compact dictionaries with headwords and inflected forms; Arabic→English listing reports ~28.9k entries | CC BY-SA 4.0 for the listed Arabic→English dictionary; preserve attribution and share-alike | Download selected compact dictionaries for lookup, not blind phrase substitution |
| [Egyptian Arabic-English Parallel Corpus](https://huggingface.co/datasets/Mo-Abdalkader/Egyptian-Arabic-English-Parallel-Corpus) | Reported 404,010 samples / 1,051,924 sentences across 1,800 daily-life topics; ~448 MB | CC BY 4.0; attribution required. Too large to embed in a Worker bundle or Git repository | Offline evaluation and selected phrase extraction; do not upload the full corpus to GitHub |
| [Alexandria dialectal Arabic dataset](https://huggingface.co/datasets/UBC-NLP/alexandria) | English↔Arabic dialectal translation/dialogue data across several Arab dialects | CC BY-NC 4.0: non-commercial restriction; do not use in a commercial product without permission | Research/evaluation only unless rights are clarified |

## Integration policy

1. data/phrasebook.json is the small, runtime-safe exact-phrase pack. It is checked before remote translation engines.
2. Exact phrase matches are only returned when the entire normalized message matches. We do not replace arbitrary words inside a sentence because that can break grammar, gender, tense, negation, or context.
3. data/chat-abbreviations.json is a reference lexicon. Abbreviations are ambiguous (for example, LOL, DM, ETA, and Arabic colloquialisms); expand them only when the context supports the intended meaning.
4. Large dictionaries/corpora must be filtered into compact, versioned packs. Never fetch a multi-gigabyte dictionary on every Telegram update.
5. Keep source URL, version/download date, license, attribution, and original sentence IDs alongside imported records. Do not redistribute data whose license is missing or incompatible.
6. These resources improve lexical coverage and provide examples; they do not replace a neural translation engine or guarantee fluent translation.

## Current runtime pack

- Arabic→French and Arabic→English common conversational phrases.
- English→French and English→Arabic common conversational phrases.
- More language pairs should be added only from verified, licensed translations and tested examples.