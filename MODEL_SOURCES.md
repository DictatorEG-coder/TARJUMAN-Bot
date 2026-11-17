# TARJUMAN model architecture

This repository contains the Telegram bot integration, not large model weight files.

## Text translation

- Primary engine: Meta M2M100 1.2B through Cloudflare Workers AI, model ID `@cf/meta/m2m100-1.2b`.
- Fallbacks: Gemini (when configured), Google Translate endpoint, LibreTranslate, and MyMemory.
- The M2M100 weights are hosted by Cloudflare Workers AI and invoked through the existing `AI` binding. They are not copied into this Git repository.
- Cloudflare's model documentation and usage example: https://developers.cloudflare.com/workers-ai/models/m2m100-1.2b/

## Image translation

1. Telegram photo is downloaded by the Worker.
2. Moondream 3.1 on Cloudflare Workers AI extracts visible text using `@cf/moondream/moondream3.1-9B-A2B`.
3. Extracted text is passed through the same translation pipeline as ordinary messages.
4. Gemini vision and OCR.Space remain fallbacks.

Moondream documentation: https://developers.cloudflare.com/workers-ai/models/moondream3.1-9B-A2B/

## Why Google ML Kit model files are not copied here

The Android app used Google's on-device ML Kit Translation API, which downloads and manages language models through Google's SDK. Those model packs are not a general-purpose set of files to copy into a Telegram Worker or redistribute from this repository. The supported integration is through the ML Kit SDK in an Android app:
https://developers.google.com/ml-kit/language/translation/android

## Why the Android local model packs are not copied into this Worker

The Android project's OCR and local AI packs (RapidOCR, Baberu OCR, Manga-OCR, NLLB, and Qwen GGUF variants) target on-device inference runtimes and device storage. They cannot simply be dropped into a Cloudflare Worker: model format, runtime, memory, execution limits, and hosting are different. NLLB model weights are published under CC-BY-NC-4.0, which is non-commercial; do not use those weights for a commercial bot without a suitable license.

## Runtime configuration

The Worker must retain its Cloudflare Workers AI binding:

```toml
[ai]
binding = "AI"
```

No model binary, Google ML Kit pack, Telegram token, or provider secret belongs in this repository. Secrets remain configured in Cloudflare Worker settings.


## Bundled language resources

- `data/phrasebook.json`: curated exact-match conversational phrases for Arabic, English, and French directions present in the file.
- `data/chat-abbreviations.json`: curated English chat abbreviations and Arabic colloquial reference entries.
- `data/arabic-dialect.json`: conservative Egyptian/colloquial-to-standard Arabic normalization pairs used before translation. Ambiguous fillers are intentionally not rewritten mechanically.
- These are compact project-maintained resources, not complete dictionaries or downloaded parallel corpora. Large external dictionaries and corpora require a separately provisioned data store (for example R2/D1) and license review; they are not embedded in the Worker bundle.
