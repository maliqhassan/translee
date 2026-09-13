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

### Backend URL for EAS builds

EAS builds run on EAS's machines and never see a local `.env`. Each build
profile in [eas.json](eas.json) names the EAS environment it takes variables
from — `preview` and `production`, so the two are configured independently and
a staging backend can never be baked into a store build.

The URL itself is not in this repository. Set it once per environment after the
backend is deployed:

```bash
eas env:create --scope project --name EXPO_PUBLIC_TRANSEE_API_URL \
  --value "https://<your-backend-host>" --environment preview --visibility plaintext
```

Repeat with `--environment production`. Check what a profile will build with
using `eas env:list --environment preview`.

**Plaintext, not secret.** EAS withholds secret-typed variables from the
bundler, so marking this one secret would silently produce a build with no
backend — and it is public by design anyway. Nothing secret may ever be an
`EXPO_PUBLIC_*` variable.

The value is inlined at build time, so **changing the backend URL needs a new
build**. Prefer a domain you control over a hosting provider's default
hostname; moving hosts later then costs a DNS change rather than shipping a new
binary to every user.

With no variable set the build is simply unconfigured: the online engine
reports itself unavailable and no request is attempted.

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
