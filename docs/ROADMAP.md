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
