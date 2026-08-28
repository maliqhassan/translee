# Transee -- working notes

@AGENTS.md

Offline-first translation app. Expo SDK 57, React Native 0.86, Expo Router,
TypeScript strict.

## Read first

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) -- layers and the dependency rule
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) -- tokens and components
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) -- naming, TS strictness, error handling
- [docs/ROADMAP.md](docs/ROADMAP.md) -- what is built and what is deliberately not
- [docs/OFFLINE_TRANSLATION.md](docs/OFFLINE_TRANSLATION.md) -- runtime choice, model lifecycle
- [docs/DEVICE_TESTING.md](docs/DEVICE_TESTING.md) -- Expo Go SDK matching, device workflow

## Rules that matter here

1. **Routes are one-liners.** `app/**` files only re-export a screen from
   `src/features/<feature>/screens/`.
2. **No business logic in screens.** Network calls, SQL, platform APIs and
   engine selection live in `src/services` or `src/database`.
3. **Style only through `useTheme()`.** No literal colours, font sizes or
   spacing in components. Add a token instead.
4. **Bind services in one place.** `src/services/service-registry.ts` is the
   only file that names a concrete implementation.
5. **Services return `Result`, never throw.**
6. **No SQL outside `src/database`.** Features use `HistoryRepository`; the
   only file importing expo-sqlite is `expo-sqlite-database.ts`.
7. **Preferences persist through `PreferencesService`.** No screen, component
   or hook imports a storage API; `file-preferences-storage.ts` is the only
   file importing expo-file-system.
8. **Native code lives in `modules/`.** `modules/transee-mlkit` is the only
   Kotlin in the project; it is resolved optionally, so the app still runs
   without a native build.
9. Run `npm run check` before calling work done.
