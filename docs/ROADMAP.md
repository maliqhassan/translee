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

## Not yet built

Left deliberately for later days, each with its seam already in place:

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
