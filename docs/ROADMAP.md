# Roadmap

A running log of what each day adds. Day 1 is complete; everything below it is
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

## Not yet built

Left deliberately for later days, each with its seam already in place:

| Capability             | Seam waiting for it                           |
| ---------------------- | --------------------------------------------- |
| Online translation     | `services.translation.online`                 |
| Offline translation    | `services.translation.offline`                |
| Engine routing         | `TranslationRouter`                           |
| Language packs         | `services.languagePacks`                      |
| Camera OCR             | `services.ocr`                                |
| Speech to text         | `services.speech`                             |
| Text to speech         | `services.tts`                                |
| History persistence    | `src/database` + a `Repository<HistoryEntry>` |
| Preference persistence | `PreferencesProvider` + `STORAGE_KEYS`        |

Flip the matching flag in `src/constants/config.ts` when a capability ships.
