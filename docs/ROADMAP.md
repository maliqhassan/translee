# Roadmap

A running log of what each day adds. Everything below the completed days is
intentionally unimplemented.

## Day 1 -- Foundation (done)

- Expo + TypeScript (strict) + Expo Router + ESLint + Prettier + Git
- Feature-based folder architecture and the dependency rule
- Design system: colours, typography, spacing, radii, shadows, buttons, cards,
  inputs, badges, list items, loading states, empty states
- Navigation shells: Translate, Camera, History, Settings, plus language picker,
  scan result, history detail and offline packs sub-routes
- Service interfaces and placeholders: `TranslationService`,
  `OnlineTranslationService`, `OfflineTranslationService`, `OCRService`,
  `SpeechService`, `TTSService`, `LanguagePackManager`
- Database schema, migration list and the `Database` / `Repository` seams
- Global stores: preferences, language pair

## Day 2 -- Translate/Home experience (done)

- Home screen built out: compact branded header, language bar with an animated
  swap, multiline composer with counter/clear/paste, prominent Translate
  action, result card and a recent-translations section
- Full async lifecycle in `useTranslation`: idle, translating, result, error,
  with stale responses discarded and results tied to their language pair
- `createTranslationRouter` implements the `TranslationRouter` contract and
  picks the first available engine that supports the pair
- `mockTranslationService` is a sample engine behind the real
  `TranslationService` contract, gated by `FEATURES.mockTranslation`
- `ClipboardService` added so copy and paste do not touch a platform API from
  a component
- Language picker wired to the language store; defaults are now English to
  German
- Friendly error copy in `constants/messages.ts`; technical detail stays in logs

## Day 3 -- Language catalogue and picker (done)

- Single authoritative catalogue of 89 languages in
  `constants/language-catalog.ts`, read only through the selectors in
  `constants/languages.ts`. No component defines language metadata.
- `Language` gains `id`, `isPopular`, `supportsOnline` and structured
  `offline` metadata. Script and region variants (`zh-Hans`, `zh-Hant`,
  `pt-BR`, `pt-PT`) are distinct ids that report the same base `code`.
- Language picker rebuilt: search by name, native name or code with
  accent-insensitive matching, Recent and Popular shortlists, selected state,
  clear button and an empty state — all in one virtualised FlatList.
- Language pair rules extracted to `store/language-pair-rules.ts` (pure, so
  they are testable) and recent languages tracked per side, in memory.
- `language-availability.ts` combines catalogue metadata with pack status,
  which is the seam the download days need.

## Day 4 -- Translation service infrastructure (done)

- HTTP layer: `HttpClient` seam, a fetch implementation with an
  AbortController timeout, status-to-AppError mapping, and a conservative
  retry policy that retries only dropped connections, timeouts and 5xx
- `OnlineTranslationService` built against a configurable Transee backend
  URL, reached through `TranslationProvider` and a validating `ProviderAdapter`
- Responses are validated field by field; a malformed body becomes
  `invalid_response` rather than a result with undefined text in it
- Network abstraction over expo-network with online / offline / unknown, plus
  a `NetworkProvider` for the UI side of the same fact
- Router now validates, consults connectivity and ranks engines through the
  pure `orderEngines` policy; returns a friendly offline error when nothing
  can serve the pair
- `withCache` decorator adds an LRU translation cache and request
  de-duplication around whichever engine runs
- New error codes: timeout, rate_limited, invalid_request, invalid_response,
  each with user-facing copy in `constants/messages.ts`
- Unit test runner on Node's built-in test module, zero new dependencies;
  111 tests including the Day 2 and Day 3 behaviour as regression cover

No provider API is called and no credential exists in the app. With no backend
URL configured, the online engine reports itself unavailable and the sample
engine continues to serve development.

## Day 5 -- Real online translation (done)

- Backend added in `server/`: its own package, dependencies, tsconfig and test
  suite. It holds the provider credential so the app never has to.
- Provider: Azure AI Translator. 138 languages, covering 87 of our 89, and it
  already speaks the script-qualified codes our LanguageIds use.
- `POST /translation` takes and returns the Transee contract only; no provider
  field ever reaches the app.
- `shared/provider-languages.json` is generated from the provider's live
  language endpoint and read by both sides, so support is decided once.
- Backend validates types, emptiness, length, body size, language support and
  same-to-same pairs, and normalises every provider error and status.
- Fixed-window in-memory rate limiting with `Retry-After`.
- The registry now picks the engine from configuration: no backend URL means
  the sample engine, exactly as before; setting one switches to real online.
- Recent translations are recorded in an in-memory session store, still with
  no database.

Real provider integration needs a manually supplied Azure key; everything was
verified end to end against the deterministic fake provider.

## Day 6 -- Persistent history (done)

- Translation history now lives in SQLite via expo-sqlite, behind the Day 1
  `Database` seam. No component or hook touches SQLite.
- `HistoryRepository`: create, getById, listRecent, listFavorites, search,
  setFavorite, toggleFavorite, remove, clear, count, plus change
  notifications so screens refresh without polling.
- Migration runner keyed on SQLite's `user_version`; migrations are
  append-only, idempotent and safe to replay. Schema is at version 2.
- `DatabaseProvider` initialises once at startup without gating rendering, so
  translation still works if storage fails and history reports its own state.
- History screen gained search, delete and clear-all with confirmations; the
  detail screen loads the real record and handles a deleted one.
- Favourites persist on the history row -- no second table.
- Search, ordering and paging are done by SQLite, never in JavaScript, and
  every query is parameterised with LIKE wildcards escaped.
- The in-memory session store and its sample data are gone.

History is device-local, never uploaded, and no source or translated text is
ever logged.

## Day 7 -- Settings and persistent preferences (done)

- Preferences persist to a small JSON document via expo-file-system, behind a
  `PreferencesStorage` seam. SQLite stays with structured history.
- Five settings, all wired to real behaviour: source and target language,
  translation mode, theme and save-history. Settings for capabilities that do
  not exist yet were removed rather than left as switches that do nothing.
- The language store still owns the pair at runtime; it hydrates from
  preferences and writes back using the same Day 3 pure rules.
- `translationMode` (auto / online / offline) restricts routing literally:
  choosing on-device with no pack installed returns `model_missing` instead of
  quietly using the network.
- `saveHistory` now governs whether a completed translation is recorded.
- Reset restores the documented defaults and persists them.
- Stored preferences are validated field by field; anything unusable falls
  back to its default, and unreadable storage never blocks a launch.

Auto-detection needed no new flag: it is a source language of `auto`, which
the catalogue, the backend and the provider already support, so persisting the
source language persists it. Haptics were deferred rather than adding a native
module for one toggle.

## Day 8 -- Offline engine foundation (done)

- Runtime researched and chosen: Google ML Kit on-device Translation. The
  decision, the alternatives rejected and the blockers are in
  [OFFLINE_TRANSLATION.md](OFFLINE_TRANSLATION.md).
- `OfflineTranslationEngine` is the single seam a runtime implements;
  `OfflineTranslationService` adapts it to the router's `TranslationService`.
- Model registry joins the catalogue with runtime capability. Models are keyed
  **per language**, because ML Kit is -- a ready pair is derived from both
  sides being loaded.
- Model lifecycle as a tested state machine: `ready` is reachable only from
  `loading`, so a failed download or load can never look usable.
- Runtime manager loads a model once, keeps it, and collapses concurrent loads.
- `ModelStorage` implemented over expo-file-system; `ModelDownloader` is a
  contract only, since ML Kit fetches its own models.

No runtime ships yet: the registered engine reports unavailable, and every
catalogue entry still says `offline.supported: false`. Integration needs a
development build and is Day 9.

## Day 9 -- ML Kit integration (written, not yet built)

- Re-checked the published binding rather than assuming: still 0.5.0 from
  September 2025, no codegenConfig, legacy ReactContextBaseJavaModule, no Expo
  plugin. Unusable on RN 0.86, so it was not installed.
- Wrote a local Expo module instead, modules/transee-mlkit: Kotlin, Android
  only, New-Architecture native via the Expo Modules API, seven functions and
  no policy. No npm dependency added.
- createMlKitOfflineEngine implements the Day 8 OfflineTranslationEngine
  contract against it, with the native module injected so the whole engine is
  testable without a device.
- Explicit language mapping: 55 of 89 catalogue languages. Chinese and
  Portuguese variants are excluded because ML Kit has only unqualified zh and
  pt, and promising a variant we cannot guarantee would be a lie.
- No progress, size or checksum is reported, because ML Kit exposes none.

Nothing has been compiled or run: this machine has no Android SDK. Autolinking
discovers the module and the bundle still exports, but the Kotlin is unverified
until Day 10 builds it on a real device.

## Day 10 -- Native build attempt (blocked; two real defects fixed)

The goal was to compile, install and test the ML Kit module on a device. The
environment cannot: there is a JDK, but no Android SDK, no adb, no emulator,
no Android Studio and no Gradle. `expo run:android` stops at SDK resolution
and never reaches Kotlin compilation, so **nothing has been compiled or run**.

Static verification found two defects that would each have failed a build:

- the module's `build.gradle` used the pre-SDK-52 style instead of applying
  `expo-module-gradle-plugin`, which is what every SDK 57 module uses to get
  its SDK levels, toolchains and core dependency
- `translate` called `downloadModelIfNeeded`, which fetches a missing model
  over the network mid-translation -- exactly what offline mode promises not to
  do, and the comment above it claimed the opposite

Also added: the offline guarantee is now proved at the request layer. In
offline mode an HttpClient spy records zero requests, with a control case
showing the spy does record traffic in online mode. That is not the same as
testing with the radio off.

The language mapping was left at 55 of 89. Widening it needs device evidence,
not a decision.

## Day 11 -- Native build attempt (blocked again; no Android SDK)

A verification day, not a feature day: compile the Kotlin, run it on a device
and settle the questions Day 10 left open. The environment was re-checked from
scratch rather than assumed, in case tooling had been installed since:

| Tool                                  | Status                  |
| ------------------------------------- | ----------------------- |
| JDK 17.0.19                           | present                 |
| ANDROID_HOME / ANDROID_SDK_ROOT       | both unset              |
| Android SDK on disk                   | none found              |
| adb, sdkmanager, avdmanager, emulator | none on PATH or on disk |
| Android Studio                        | not installed           |
| Gradle                                | absent                  |

Unchanged from Day 10, so the native path stopped there rather than retrying a
build that cannot resolve an SDK. **No Kotlin has been compiled and nothing has
run on a device.** Every runtime question stays open: whether the module loads,
whether ML Kit translates, which script its `zh` model emits, which variant
`pt` emits, and how large a real model is on disk.

Nothing was changed to manufacture progress. The 55-of-89 language mapping,
the undefined `sizeBytes`, and `offline.supported` all stay exactly as they
were, because each needs device evidence. The Day 10 tree was re-verified
intact: 318 mobile tests, 59 backend tests, typecheck, lint and format all
clean.

`docs/OFFLINE_TRANSLATION.md` records the exact setup steps that would unblock
this.

## Day 12 -- Compiled at last, through EAS Cloud

Rather than install Android Studio locally, the build moved to EAS Cloud. The
project was linked to `@maliqhassan/transee` and an `eas.json` added with an
internal-distribution APK profile.

The first cloud build reached Gradle and failed there -- which is itself the
result Days 10 and 11 could not obtain, because nothing had ever got that far:

    A problem occurred configuring project ':transee-mlkit'.
    > 'android.defaultConfig.versionName' is not defined

A real defect, and one only a compiler could find. Day 10 correctly moved the
module onto `expo-module-gradle-plugin`, but that plugin registers a Maven
publication for every module and needs coordinates to do it. Every module
shipped in the SDK declares `group`, `version` and
`defaultConfig { versionCode, versionName }`; ours declared none. Adding those
four values fixed it.

The second build succeeded in 18m 36s. Verified from the build log and by
unpacking the APK:

- `transee-mlkit (0.1.0)` is autolinked
- `:transee-mlkit:compileReleaseKotlin` succeeded, with no errors or warnings
- `expo.modules.transeemlkit.TranseeMlKitModule` is in `classes3.dex`,
  alongside `com.google.mlkit.nl.translate` -- so the ML Kit dependency
  resolved and was packaged
- the APK is signed (APK Signature Scheme v2) and installable
- eight permissions, none introduced by our module or by ML Kit

**Still nothing has run.** Compiling is not translating. Every runtime question
Day 11 listed stays open, and `offline.supported`, `sizeBytes` and the 55-of-89
mapping are all unchanged, pending results from a real phone.

## Day 13 -- Language packs, connected to the real runtime

The first screen that manages on-device models. It lists one row per language
the runtime says it can serve, with four states: not downloaded, downloading,
downloaded, failed. Reached from Settings under Translation.

Everything on it comes from the engine's own `listModels()`, so a language
cannot appear because the catalogue contains it -- only because a runtime
reported it. That is 55 rows, not 89: `zh-Hans`, `zh-Hant`, `pt-BR`, `pt-PT`,
`sr` and `mn` are absent, and a test asserts every listed language is one ML
Kit actually has.

Two defects were fixed on the way:

- **`loadModel` downloaded.** ML Kit's engine implemented "load" as
  `downloadModel`, so anything on the translation path that loaded a model
  would have fetched it over the network -- the same defect Day 10 fixed in
  the Kotlin, still present one layer up. `downloadModel` and `deleteModel`
  are now their own operations on the engine contract, and `loadModel` checks
  presence and fails with `model_missing` instead.
- **`unloadModel` deleted the model**, while the contract said it releases
  memory and leaves files on disk. A delete button wired to it would have
  depended on behaviour the interface denied.

The Day 1 `LanguagePackManager` placeholder was removed rather than filled in.
It modelled packs as **pairs** with a required `sizeBytes: number`, both of
which are wrong for this runtime: a pair-shaped catalogue would be 55 x 54
entries describing files that do not exist, and ML Kit reports no sizes. The
replacement has no size field at all, so a fake number is unrepresentable.

**No device evidence.** The screen has never run on hardware. Whether a
download actually completes, how long it takes, how large a model really is
and whether translation then works are all still unverified -- Day 12 compiled
the module, which is not the same as running it. `offline.supported` in the
catalogue is still `false` everywhere.

## Day 14 -- Offline UX made honest

No native change, no new dependency. The work was making the TypeScript side
explain itself.

`model_missing` was doing too much: it covers a missing source model, a
missing target model, and a runtime that is not in the build at all -- three
problems with three different fixes, all of which reached the user as "that
language pack is not downloaded yet". `offlineReadiness()` now answers the
question properly, as a pure function of what the runtime reported, and it is
asked _before_ the user presses Translate rather than after it fails:

    runtime_missing | source_undetectable | unsupported | packs_missing | ready

In on-device mode the translate screen shows what is missing and, when
downloading would actually help, a button that opens Language Packs. When it
would not help -- an unsupported language, or no runtime -- no download is
offered, because a dead end is worse than a plain explanation. Readiness is
re-checked on focus, so returning from a download does not leave a stale
notice.

Three defects fixed along the way:

- **Deleting a pack displayed "Downloading".** Both actions set the same busy
  override. `removing` is now its own state, and the two can no longer be
  confused.
- **The packs screen rendered `AppError.message`**, which is log copy by
  convention. It now maps through `errorMessage` like every other surface.
- **A double tap could race.** The in-flight guard was read from a state
  updater, which React does not run until the next render; it is a ref now.

Still nothing has run on hardware. Whether a download completes, how long it
takes, and whether translation then works remain unverified.

## Day 15 -- Text to speech

The roadmap's remaining seams were Camera OCR, speech to text and text to
speech. Only the last can be built honestly right now: `expo-speech` is
first-party, ships inside Expo Go, and needs no config plugin and no native
build, while the other two would mean new Kotlin and a device to verify it on.
So the Listen button -- disabled since Day 1, and called out in this table --
is the one that got wired up.

`createExpoTTSService` is the only file in the app importing `expo-speech`,
matching the rule that one file owns each platform API; a test asserts that
stays true. It wraps a fire-and-forget native call so callers get a `Result`
that settles when the utterance actually ends, which is what a speaking
indicator needs. Stopping resolves as success rather than as an error, because
the user asked for it.

The control appears only when two things are both true: `FEATURES.textToSpeech`
says the capability shipped, and the device reports at least one installed
voice. A phone with no speech engine gets no button rather than a dead one.

Nothing is invented. Our LanguageIds are already BCP-47 tags, so the language
is passed straight through with no mapping; `auto` is refused rather than
guessed; and text longer than the platform's own `maxSpeechInputLength` is
rejected before the call.

**Speaking is not offline.** Android hands text to whichever TTS engine is
installed, and some fetch voices over the network. That is the platform's
behaviour, not ours, and it is why speaking is nowhere described as an offline
capability. It is also a separate action from translating: offline mode's
guarantee covers the translation, which has already finished by the time the
button can be pressed.

## Day 16 -- Routing corrected: the sample engine stops standing in

A defect, not a feature. Everything built across Days 8 to 15 for on-device
translation was unreachable in the build that actually shipped.

`service-registry.ts` replaced its entire candidate list with the sample engine
whenever `EXPO_PUBLIC_TRANSEE_API_URL` was unset -- the default, and the state
of the Day 12 APK. The offline engine was therefore never a candidate, so
downloading English and German, selecting "on-device only" and pressing
Translate returned a **sample** result. `routing-policy.ts` made it worse by
exempting the sample engine from mode filtering, so a stand-in could satisfy a
mode the user had explicitly chosen. Day 14's readiness notice, which reads the
runtime directly rather than the router, would meanwhile report the pair as
ready -- so the UI asserted readiness while the router served a fake.

Three changes, all small:

- both real engines are now unconditional candidates; an engine's own
  `isAvailable` decides whether it can run, which is what it was always for
- the sample engine is admitted only by `FEATURES.mockTranslation`, ranks
  behind every real engine, and is eligible only in `auto`
- the router distinguishes "no engine handles this pair" from "no engine is
  available at all", so an unconfigured build reports `service_unavailable`
  instead of blaming the languages

The sample engine was demoted, not deleted, as planned.

**This makes the default build fail where it used to appear to work.** With no
backend configured and no native module, translation now returns
`service_unavailable` rather than a plausible-looking sample. That is the
correct behaviour: the previous output was fiction.

Six tests across four files pinned the old behaviour and were rewritten to pin
the new; none were weakened. A new suite exercises the case none of them
covered -- the sample engine present _alongside_ the real engines, where
"correctly refused" can be told apart from "there was nothing else anyway".

## Day 17 -- Speech to text

Dictation, over the platform recogniser. Tap the microphone in the composer,
speak, and the transcript fills the same draft the keyboard writes to. Nothing
is translated automatically: the user reads it, fixes anything misheard, and
presses Translate, exactly as with typed text.

`expo-speech-recognition@57.0.0` was added after inspecting it rather than
trusting it -- the same check Day 9 applied to an ML Kit binding and rejected.
This one passes: it is a real Expo module (`Module()` + `ModuleDefinition`, so
New-Architecture native), its Gradle file uses `expo-module-gradle-plugin` with
the coordinates Day 12 taught us are mandatory, it has zero runtime
dependencies, it is MIT, and its version tracks SDK 57.

The alternative was writing our own Kotlin wrapper around Android's
`SpeechRecognizer`, as we did for ML Kit. That was rejected on honesty grounds:
`transee-mlkit` is a thin call-and-return surface, while `SpeechRecognizer` is
a stateful lifecycle with partial results, restarts, audio focus and
package-visibility rules -- a large amount of native code we could not run even
once. Vendoring a maintained module we can read beats hand-rolling one we
cannot test.

Its config plugin adds two things to the manifest, both genuinely required:
`RECORD_AUDIO`, and a `<queries>` entry for `android.speech.RecognitionService`
without which Android 11+ reports recognition unavailable regardless.

**Not offline.** On most Android devices the recogniser streams audio to Google
to transcribe it. That is documented rather than glossed over, and it changes
nothing about the on-device translation guarantee, which is a different
capability.

**Not verified on hardware.** No one has spoken into it. The permission flow,
the transcript, the language handling and whether a given device has a
recogniser at all are open until someone tests the next build.

## Day 18 -- Camera OCR

Point the camera at a menu, tap once, and the text lands in the draft you were
about to translate. Nothing is translated automatically: scanned text behaves
exactly like typed and dictated text.

`@react-native-ml-kit/text-recognition` was inspected and rejected for the
same reasons Day 9 rejected its sibling: `codegenConfig` absent and
`ReactContextBaseJavaModule` at its core, which is an old-architecture bridge
module on a New-Architecture-only React Native. Instead the recogniser is a
second Expo module class inside the `transee-mlkit` project we already build
and already ship -- `com.google.mlkit:text-recognition:16.0.1`, bundled.

That bundling is the interesting decision. The unbundled play-services variant
is ~260KB but downloads its model at runtime; the bundled one adds ~4MB per
architecture and works immediately, offline, with nothing to fetch. For an
offline-first app that trade is worth taking, and it makes scanning the only
capability here that is offline without qualification.

`expo-camera` supplies the preview and the shutter. It is first-party, in
Expo Go, declares `CAMERA` in its own manifest, and needed no `app.json`
change.

Two things are deliberately absent because ML Kit does not report them: block
confidence (the seam's field became optional) and a detected language. The
same rule as model sizes -- a field a runtime cannot fill stays undefined.

Adding the camera sheet also surfaced the project's first literal colours; they
became `cameraSurface`, `onCamera` and `onCameraMuted` tokens, identical in
both themes because a live camera feed does not follow the app's theme.

**Not verified on hardware.** No camera has been opened. Whether the preview
renders, the permission dialog appears, a capture succeeds or any real text is
recognised are all open until someone tests a build.

## Not yet built

Every capability in the original plan now has an implementation. What remains
is hardware verification, not code.

Everything else in the original plan has shipped:

| Capability              | Shipped   | Where                                       |
| ----------------------- | --------- | ------------------------------------------- |
| Online translation      | Day 5     | `services.translation.online`               |
| Persistent history      | Day 6     | `src/database` + `useRecentTranslations`    |
| Preference persistence  | Day 7     | `PreferencesService`                        |
| Full language catalogue | Day 3     | `constants/languages.ts` (89 languages)     |
| Offline translation     | Days 8-13 | `services.translation.offline`              |
| Language packs          | Day 13    | `services.offlineModels`                    |
| Text to speech          | Day 15    | `services.tts` (the Listen button is live)  |
| Speech to text          | Day 17    | `services.speech` (mic in the composer)     |
| Camera OCR              | Day 18    | `services.ocr` (camera in the composer)     |
| Connectivity routing    | Day 16    | the candidate list in `service-registry.ts` |

Offline translation is shipped in the sense that the code exists, compiles and
is packaged; it is **not** verified on hardware, and `offline.supported` stays
`false` across the catalogue until a device says otherwise.

`FEATURES.mockTranslation` is the only switch that admits the sample engine.
Deleting `mock-translation-service.ts` is possible once a backend is configured
by default, but until then it is the only way to exercise the app end to end.
