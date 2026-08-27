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
