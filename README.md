# Transee

An offline-first mobile translation app built with Expo, React Native and
TypeScript.

> Status: Day 1 of 20. The foundation, design system and navigation are in
> place. Translation, OCR, voice and offline models are intentionally not
> implemented yet -- see [docs/ROADMAP.md](docs/ROADMAP.md).

## Getting started

```bash
npm install
npm start          # then press "a" for Android
```

Or launch Android directly:

```bash
npm run android
```

## Connecting real translation

Translation runs through a small backend in [server/](server/), which holds the
provider credential. The app only ever knows the backend URL.

With no backend configured the app uses its built-in sample engine, so it runs
out of the box. To use real translation:

```bash
cd server && npm install
cp .env.example .env      # add your Azure Translator key
npm run build && npm start
```

Then point the app at it and restart the dev server:

```bash
EXPO_PUBLIC_TRANSEE_API_URL=http://<your-host>:8787 npx expo start
```

No Azure account? Run the backend's deterministic stand-in instead:

```bash
cd server && TRANSLATION_PROVIDER=fake npm start
```

`EXPO_PUBLIC_*` values are inlined into the app bundle and are public. Only the
backend URL belongs there — never a provider key. See
[server/README.md](server/README.md).

## Scripts

| Command             | Purpose                                |
| ------------------- | -------------------------------------- |
| `npm start`         | Expo dev server                        |
| `npm run android`   | Build and run on Android               |
| `npm run ios`       | Build and run on iOS (macOS)           |
| `npm run web`       | Run in the browser                     |
| `npm run typecheck` | `tsc --noEmit`                         |
| `npm run lint`      | ESLint                                 |
| `npm run format`    | Prettier write                         |
| `npm test`          | unit tests                             |
| `npm run check`     | typecheck + lint + format check + test |

## Structure

```
app/                Expo Router routes (one-line re-exports)
  (tabs)/           Translate, Camera, History, Settings
  translate/        Language picker
  camera/           Scan result
  history/          History detail
  settings/         Offline language packs
src/
  components/       Design system (ui/ + layout/)
  features/         translation, offline, camera, voice, history, settings
  services/         Service interfaces and placeholders
  store/            Preferences and language-pair providers
  database/         Schema, migrations, Database/Repository seams
  hooks/            useTheme, useDebouncedValue
  utils/            Result, formatting, ids, logging
  constants/        Design tokens, config, language reference data
  types/            Shared domain types
assets/
docs/
```

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Conventions](docs/CONVENTIONS.md)
- [Roadmap](docs/ROADMAP.md)
