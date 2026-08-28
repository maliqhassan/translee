# On-device translation

How Transee will translate without a network, which runtime it will use, and
why. Written on Day 8, when the architecture was built; the runtime itself is
integrated on Day 9.

## Status

**No machine-translation runtime ships in the app today.** The seams described
below are complete and tested, and the engine currently registered reports
honestly that it cannot translate. Nothing claims offline support that does not
have it: every entry in the language catalogue still says
`offline.supported: false`, and the engine returns `model_missing`.

That is deliberate. Integrating the runtime needs a native module and a
development build, and neither exists in this project yet.

## The decision

**Google ML Kit on-device Translation**, integrated on Day 9 behind the
`OfflineTranslationEngine` seam.

What the [official Android documentation](https://developers.google.com/ml-kit/language/translation/android)
states, and which is why it was chosen:

- **"Language models are around 30MB"** — small enough to download on demand
  over a normal connection, and to keep several installed.
- **"more than 50 languages"** supported.
- **On-demand dynamic model downloads**, so nothing is bundled into the APK and
  the download size does not grow with the number of languages offered.
- Translation works **without a network once a model is downloaded**.
- Free, with no API key, so nothing credential-shaped ever reaches the bundle.

### The architecturally load-bearing detail

ML Kit **keys models by language, not by language pair**. A
`TranslateRemoteModel` is built from a single language
(`TranslateRemoteModel.Builder(TranslateLanguage.GERMAN)`), and translating
between two languages needs both models present.

This shaped the design directly:

- `OfflineModel` is **per language**, not per pair.
- A ready _pair_ is a **derived** fact — both sides installed and loaded — which
  is what `ModelRegistry.isPairReady` computes.
- The existing pair-shaped `LanguagePack` (`en-de`) stays the unit the packs
  _screen_ talks about, but it is a view over per-language models rather than a
  thing that is downloaded.

Getting this backwards would have meant a registry that could never map onto
the runtime.

## Alternatives considered

| Runtime                                                                                 | Why not                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ONNX Runtime** (`onnxruntime-react-native`, actively maintained) with OPUS-MT or NLLB | Technically capable and framework-neutral, but it is a model _runtime_, not a translation product. We would own SentencePiece tokenisation, beam search and detokenisation ourselves, in JS or another native module. NLLB-200 distilled is hundreds of megabytes even quantised, against ML Kit's ~30MB per language. A large amount of work to end up slower and bigger. |
| **react-native-executorch** (Software Mansion, actively maintained, Expo-friendly)      | The best-supported RN inference library, but its published task list covers vision, speech, embeddings and LLMs — **no translation models**. Using an LLM to translate means a multi-gigabyte download and far slower inference for a worse result than a purpose-built MT model.                                                                                          |
| **llama.rn / on-device LLM**                                                            | Same objection, more so. Wrong tool: a general model doing a specific job at enormous cost in size, memory and latency.                                                                                                                                                                                                                                                    |
| **Bergamot / Marian (Firefox Translations)**                                            | Genuinely good small MT models, but they target WASM in a browser. No React Native binding exists; we would be writing and maintaining a native module ourselves.                                                                                                                                                                                                          |
| **TensorFlow Lite**                                                                     | Same objections as ONNX — a runtime, not a translation solution, with the tokenisation problem unsolved.                                                                                                                                                                                                                                                                   |

## Why the integration is not done today

Two independent blockers, both real:

1. **A native module needs a development build.** ML Kit is an Android library;
   it cannot run in Expo Go, and this project has no development build. That is
   a known, separately-tracked gap (see [DEVICE_TESTING.md](DEVICE_TESTING.md)),
   and there is no Android SDK on the current machine to produce one.

2. **The available React Native binding is not verifiably compatible.** The only
   maintained-looking npm package for ML Kit translation,
   `@react-native-ml-kit/translate-text`, was last published in **September
   2025** at version 0.5.0. It ships **no Expo config plugin** and makes no
   New Architecture claim. React Native 0.86 is New-Architecture-only. Adding a
   native dependency that cannot be built or run here would be guessing.

So Day 8 built the seams instead, and Day 9 does the integration on a machine
that can build and run it.

## Architecture

```
UI
 ↓  never knows any of the below
useTranslation
 ↓
TranslationRouter          picks an engine from mode + connectivity
 ↓
OfflineTranslationService  adapts the engine to TranslationService
 ↓
OfflineTranslationEngine   the one seam a runtime implements
 ↓
ML Kit                     (Day 9)
 ↓
downloaded model
```

Everything runtime-specific stops at `OfflineTranslationEngine`. Swapping ML Kit
for something else is a new implementation of that interface plus one line in
`service-registry.ts`.

### Supporting pieces

- **`ModelRegistry`** joins the language catalogue with what a runtime reports
  it can do. The catalogue stays authoritative for language _identity_; the
  runtime is authoritative for _capability_. A runtime naming a language the
  catalogue does not know is dropped as a mapping bug rather than inventing an
  entry.
- **`model-lifecycle.ts`** is the state machine, pure and separately tested. Its
  central rule: **`ready` is reachable only from `loading`**, so a failed
  download or a failed load can never be reported as usable.
- **`ModelRuntimeManager`** loads a model once and keeps it, and collapses
  concurrent loads of the same model onto one. There is deliberately no
  eviction policy — picking a memory budget without measuring on hardware would
  be inventing a number.
- **`ModelStorage`** is the filesystem seam, implemented once over
  expo-file-system exactly like `expo-sqlite-database.ts` and
  `file-preferences-storage.ts`.
- **`ModelDownloader`** is a contract only. ML Kit downloads its own models
  through Play services and never hands us a URL, so writing a transport now
  would be building for an unconfirmed shape. The contract records the safety
  rules any implementation must honour: temporary file, checksum before the
  move, atomic finalisation, cleanup on failure, cancellation as a normal
  outcome.

## Routing behaviour

Day 7's `translationMode` keeps its meaning, and the router honours it
literally:

| Mode      | Behaviour                                                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offline` | On-device only. With no model installed: **`model_missing`**. It never quietly uses the network — silently widening a restriction the user set would be a lie. |
| `online`  | Never invokes the offline engine.                                                                                                                              |
| `auto`    | Best available. Prefers offline when there is no connection and a model is ready; otherwise online.                                                            |

## Security and privacy

- Translating offline means **the text never leaves the device** — that is the
  point of the feature, not a side effect.
- Model files are treated as **untrusted downloaded assets**. The downloader
  contract requires checksum verification before a file is moved into place.
- Model ids are namespaced `runtime:language` and passed through
  `toModelFilename`, so an id can never escape the models directory.
- **No user text is logged** anywhere in this stack, and no model metadata or
  storage path carries translated content.
- ML Kit needs **no API key**, so nothing credential-shaped enters the bundle.
- No analytics or telemetry was added.

## What Day 9 must do

1. Create an Android development build (needs Android Studio + SDK, or EAS).
2. Evaluate `@react-native-ml-kit/translate-text` against RN 0.86 and the New
   Architecture on that build. If it does not work, the fallback is a small
   Expo module wrapping ML Kit's translate API directly — the seam makes either
   choice invisible to the app.
3. Implement `OfflineTranslationEngine` over it, and register it in place of
   `unavailableOfflineEngine`.
4. Populate `RuntimeCapability.languages` from ML Kit's real language list,
   mapped onto Transee LanguageIds — keeping `zh-Hans` / `zh-Hant` and the
   Portuguese variants distinct.
5. Only then, set `offline.supported` on the catalogue entries the runtime
   actually covers, with the real model size.
