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

## Not yet built

Camera OCR and speech to text remain. Both need native work and a device to
verify, so they wait for the deferred device-testing day. The rows below that
have since shipped are marked accordingly.

| Capability              | Seam waiting for it                            |
| ----------------------- | ---------------------------------------------- |
| Online translation      | `services.translation.online`                  |
| Offline translation     | `services.translation.offline`                 |
| Connectivity routing    | the candidate list in `service-registry.ts`    |
| Language packs          | `services.languagePacks`                       |
| Camera OCR              | `services.ocr`                                 |
| Speech to text          | `services.speech`                              |
| Text to speech          | `services.tts` (the Listen button is disabled) |
| History persistence     | `useRecentTranslations` + `src/database`       |
| Preference persistence  | `PreferencesProvider` + `STORAGE_KEYS`         |
| Full language catalogue | `constants/languages.ts`                       |

Flip the matching flag in `src/constants/config.ts` when a capability ships.
Turning off `FEATURES.mockTranslation` restores the real engine order and the
sample engine can then be deleted.
