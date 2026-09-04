# On-device translation

How Transee will translate without a network, which runtime it will use, and
why. Written on Day 8, when the architecture was built; the runtime itself is
integrated on Day 9.

## Status

**A real ML Kit integration is written. It has still never been compiled or run.**

Day 9 replaced the placeholder engine with one that drives Google ML Kit
through a local Expo native module. Every line of TypeScript is tested against
a fake native module. The Kotlin has not been built, because this machine has
no Android SDK — see _Device testing_ below for exactly what that leaves
unverified.

Until a build exists, `requireOptionalNativeModule` resolves to `null`, the
engine reports itself unavailable, and offline mode returns `model_missing`
rather than falling back to the network. The catalogue still reports
`offline.supported: false` for every language: that flag is set only once a
device confirms the models work.

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

## The integration (Day 9)

### Why a custom module, not the published binding

`@react-native-ml-kit/translate-text` was re-checked rather than assumed, and it
is not usable here:

- still 0.5.0, last published **2025-09-01**
- **no `codegenConfig`** in its package.json, and its Android source extends
  `ReactContextBaseJavaModule` — an old-architecture bridge module
- ships **no Expo config plugin** (25 files; only a podspec and a build.gradle)

React Native 0.86 is New-Architecture-only, so a legacy bridge module is at best
interop-dependent and at worst broken, and nothing available here could verify
which.

So Day 9 wrote a small local Expo module instead: `modules/transee-mlkit`. The
Expo Modules API is New-Architecture native, needs no config plugin, and
autolinks straight from the `modules/` directory with nothing published to npm.
**No npm dependency was added.**

### The native surface

Deliberately tiny — seven functions, and no policy:

`getSupportedLanguages`, `getDownloadedLanguages`, `downloadModel`,
`deleteModel`, `translate`, `closeTranslator`, `closeAll`.

Routing, pair readiness and error mapping all stay in TypeScript, where they are
testable. The Kotlin holds one thing of substance: a translator cache keyed by
pair, closed on teardown so native resources are not leaked.

The TypeScript layer refuses to call `translate` unless both models are already
downloaded, which is what keeps offline mode genuinely offline rather than
letting ML Kit quietly fetch a model mid-translation.

### Language mapping: 55 of 89

ML Kit exposes **59** languages; our catalogue has 89. The join is explicit in
`mlkit-languages.ts`, and the rule is deliberately strict: a LanguageId maps
only when it is itself an ML Kit code, or has an alias that is unambiguous.

| Case                               | Decision                                                         |
| ---------------------------------- | ---------------------------------------------------------------- |
| `en de es fr ja ar ur` + 46 others | direct match, supported                                          |
| `nb` to `no`, `fil` to `tl`        | aliased: one catalogue entry, one ML Kit code, nothing ambiguous |
| `zh-Hans`, `zh-Hant`               | **excluded** — ML Kit has one unqualified `zh`                   |
| `pt-BR`, `pt-PT`                   | **excluded** — ML Kit has one unqualified `pt`                   |
| `sr`, `mn`                         | **excluded** — ML Kit does not have them at all                  |

The variant exclusions are the important judgement call. Mapping `zh-Hant` onto
`zh` would risk returning Simplified characters to someone who asked for
Traditional — the wrong script, not a dialect preference — and there is no way
to know which the single model produces without running it. Rather than promise
a variant we cannot guarantee, all four are excluded until a device settles it.
A test asserts that no two LanguageIds ever collapse onto the same ML Kit code.

`auto` is **not** an ML Kit model. Language identification is a separate ML Kit
library this build does not include, so an `auto` source returns
`unsupported_language` instead of a guess.

### What ML Kit does not tell us

Represented as absent rather than invented:

- **no download progress.** The API resolves on completion with no byte count,
  so there is no percentage to show.
- **no model size.** The ~30MB figure is prose in the documentation, not an API
  value, so `sizeBytes` is left undefined.
- **no checksum.** ML Kit verifies its own downloads through Play services.
- **no cancellation.** `RemoteModelManager.download` returns a Task with no
  cancel, so the contract does not pretend otherwise.

## Device testing

**The module compiles and ships in an APK. It has still never been run.**

Days 10 and 11 could not compile it: this machine has a JDK but no Android SDK,
no adb, no emulator, no Android Studio and no Gradle. Day 11 re-checked and
found the same, so rather than install a local toolchain the build moved to
**EAS Cloud**.

### What the cloud build settled

The first cloud build failed inside Gradle, which no earlier attempt had even
reached:

    A problem occurred configuring project ':transee-mlkit'.
    > 'android.defaultConfig.versionName' is not defined

`expo-module-gradle-plugin` registers a Maven publication for every module and
requires coordinates to build one. Day 10 adopted the plugin correctly but did
not add them. Every module shipped in the SDK declares `group`, `version` and
`defaultConfig { versionCode, versionName }`; adding the same four values fixed
it. This is the third real defect found in this module, and the first that only
a compiler could have found.

The second build succeeded in 18m 36s (568 Gradle tasks). Confirmed from the
log and by unpacking the artifact:

| Question         | Answer                                                                |
| ---------------- | --------------------------------------------------------------------- |
| Autolinked?      | yes, `transee-mlkit (0.1.0)`                                          |
| Kotlin compiles? | yes, `:transee-mlkit:compileReleaseKotlin`, no errors or warnings     |
| In the APK?      | yes, `expo.modules.transeemlkit.TranseeMlKitModule` in `classes3.dex` |
| ML Kit resolved? | yes, `com.google.mlkit.nl.translate` classes packaged alongside it    |
| Signed?          | yes, APK Signature Scheme v2                                          |
| Secrets?         | none; no Azure key or auth header in the bundle                       |

Permissions in the release APK, none of them added by this module:

    ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE   expo-network
    INTERNET                                  expo-file-system
    READ/WRITE_EXTERNAL_STORAGE               expo-file-system (maxSdkVersion 32)
    VIBRATE                                   React Native
    SYSTEM_ALERT_WINDOW                       React Native -- see below
    DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION  androidx, app-scoped

ML Kit contributed no permission of its own. It registers a JobService for model
downloads, guarded by the platform's `BIND_JOB_SERVICE`, which is a service
attribute rather than a permission the app requests.

`SYSTEM_ALERT_WINDOW` ("draw over other apps") is worth noting: it is declared
in React Native's Android artifact and reaches the release APK from there, not
from anything in this project. It can be stripped with a `tools:node="remove"`
entry if we decide it should not ship.

### What is still unverified

Compiling is not translating. Nothing in the list below has been observed, and
none of it can be until the APK runs on a phone:

- that the native module actually loads at runtime
- that ML Kit translates anything, in any pair
- that a model downloads, and how large it really is
- which script the `zh` model emits and which variant `pt` emits
- that translation genuinely works with the radio off
- the model lifecycle on hardware: absent, download, ready, delete

Accordingly `offline.supported`, `sizeBytes` and the 55-of-89 mapping are all
unchanged.

## Managing packs (Day 13)

A pack is **one language**. Downloading English and German is what makes
`en -> de` and `de -> en` work; there is no pair to download and no pair
stored anywhere.

The screen lists what `OfflineTranslationEngine.listModels()` returns, which is
the 55 catalogue ids ML Kit can serve. States shown are exactly four:

    not downloaded / downloading / downloaded / failed

`downloading` and `failed` are held by the screen, not written back into the
runtime's view, so an attempt in flight can never be mistaken for a model the
device actually has. There is **no progress bar**: ML Kit resolves on
completion and reports no byte count, so a percentage would be invented. There
is **no size**: the pack type has no size field, which makes displaying one
impossible rather than merely discouraged.

Four engine operations, kept separate on purpose:

- `downloadModel` -- the only one that uses the network, and only on a tap
- `deleteModel` -- removes the files
- `loadModel` -- checks the model is present; **never downloads**
- `unloadModel` -- releases memory, leaves the files alone

Before Day 13, `loadModel` was implemented as a download and `unloadModel` as
a delete. The first was the Day 10 defect one layer higher up: anything that
loaded a model on the translation path would have fetched it over the network.

### Saying why (Day 14)

An error code is not an explanation. `model_missing` is returned for a missing
source model, a missing target model and an absent runtime, so the screen asks
a separate question instead of guessing from the code:

```
offlineReadiness({ runtimeAvailable, supported, downloaded, source, target })
```

It is pure, does no I/O, and returns one of five answers in the order they can
be acted on -- runtime first, because no download fixes that; unsupported
before missing, because offering to download a model that cannot exist is a
dead end.

Only `packs_missing` offers the packs screen. The others explain and stop.

The notice appears **only in on-device mode**: in automatic and online a
missing pack is not something the user needs to act on. And only
`model_missing` and `unsupported_language` are given offline-specific copy, so
a network timeout never turns into an invitation to download a language pack.

### Still unverified

Nothing here has run on a phone. Whether `downloadModel` completes, what it
downloads, how big it is and whether translation then works are open
questions. The APK from Day 12 proves the module compiles and is packaged --
not that any of this behaves.

## The offline guarantee

Real network isolation needs a device. The property was proved one level lower
instead: with `translationMode: 'offline'`, an `HttpClient` spy wired into the
real online engine records **zero** requests — whether the translation succeeds
on device, fails with `model_missing`, or is refused as `unsupported_language`.
A control case in the same suite asserts the spy does record traffic in online
mode, so a silent no-op cannot pass for a guarantee.

This is the strongest evidence obtainable without hardware. It is **not** the
same as testing with the radio off, and does not replace it.

## Building it

No local Android toolchain is needed, and none is installed. The build runs in
EAS Cloud:

    npx eas-cli build --platform android --profile preview

`preview` is an internal-distribution APK: standalone, with the JS bundled in.
That matters for our purposes -- a development-client build loads its JS from a
Metro server over the network, which cannot be used to test translation with the
radio off. The trade is that JS changes need a rebuild rather than a reload.

Because the working tree carries uncommitted changes, the build is invoked with
`EAS_NO_VCS=1` so the upload reflects the working tree rather than the last
commit. Without it, EAS would build from committed files and silently miss the
very fixes being tested.

## What device testing must still do

Everything below needs a phone. The APK exists; none of this has been done.

1. Install the APK and confirm the app starts and the native module resolves
   rather than degrading to the unavailable engine.
2. Confirm ML Kit translates: en to de, de to en, en to es, es to fr, and real
   text in ja to en, ar to en, ur to en.
3. Exercise the model lifecycle on device: absent, download, ready, repeat
   translation, delete.
4. Observe which script the `zh` model emits and which variant `pt` emits, then
   decide whether `zh-Hans` and `pt-BR` can be mapped. Correctness first --
   do not widen the mapping to raise the language count.
5. Measure a real model on disk, distinguishing downloaded model size from APK
   size, and document how it was measured.
6. Re-run the offline guarantee with the radio genuinely off.
7. Then, and only then, set `offline.supported` on the catalogue entries a
   device has confirmed.
