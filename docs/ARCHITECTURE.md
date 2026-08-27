# Architecture

Transee is an offline-first translation app. The architecture exists to keep a
20-day build from turning into a pile of screens: every capability arrives as a
**service behind an interface**, every screen is **composition only**, and every
visual decision comes from **design tokens**.

## Layers

```
app/            Routes only. Each file re-exports a screen from src/features.
src/features/   Feature modules: screens + the components they own.
src/components/ Design system. Knows nothing about translation.
src/services/   Interfaces + placeholders for engines, OCR, speech, packs.
src/database/   Schema, migrations and the Database/Repository seams.
src/store/      Global React state (preferences, language pair).
src/hooks/      Cross-cutting hooks (theme, debounce).
src/utils/      Pure helpers (Result, formatting, ids, logging).
src/constants/  Design tokens, feature flags, static reference data.
src/types/      Shared domain types.
```

### Dependency rule

Dependencies point **downward only**:

```
app -> features -> components / services / store / database -> hooks / utils / constants / types
```

`src/components` must never import from `src/features` or `src/services` (the
one exception is a type-only import of a service model, e.g. `LanguagePack`).
`src/constants`, `src/utils` and `src/types` import nothing from the app.

One feature may use another through its **public barrel only**
(`@/features/history`), never by reaching into its internals. The translate
screen composing `RecentTranslations` is the intended shape: the history
feature owns that data and its presentation, and home just places it.

## The translation path

The UI never selects an engine:

```
TranslateScreen -> useTranslation -> services.translation.router
                                       -> mock | online | offline engine
```

`createTranslationRouter` takes an ordered candidate list and picks the first
engine that is both available and supports the requested pair. That list is
built in `service-registry.ts`, which makes routing policy a one-line change:
adding connectivity checks or an offline-first preference never touches a
screen. `TranslationRouter` is what features depend on; `TranslationService`
is what engines implement.

## The language catalogue

`constants/language-catalog.ts` is the only place language metadata is
defined; everything reads it through the selectors in `constants/languages.ts`.

A `Language` carries two identifiers. `id` is the identity used by the pair,
a translation request and a history row; it is the ISO code, plus a BCP-47
subtag where the base code is ambiguous (`zh-Hans` vs `zh-Hant`). `code` is
the bare ISO code an engine keys off. Both Chinese entries report `zh`.

`offline` is structured rather than a boolean so the download days have
somewhere to put the model identity and size. Every entry reports
`supported: false` until a real model is chosen — that is a data edit, not a
refactor. `services/language-packs/language-availability.ts` combines that
metadata with pack install state, and does no I/O.

Pair transitions live in `store/language-pair-rules.ts` as pure functions, so
the swap-on-collision rule can be tested without React.

## Why routes are one-liners

`app/(tabs)/index.tsx` is a single re-export. Routing then stays a map of URLs
to screens, and screens stay testable without a router. Adding a screen is:

1. Write it in `src/features/<feature>/screens/`.
2. Export it from that feature's `index.ts`.
3. Add a one-line route file under `app/`.

## Services

Every engine implements a `Service` from `src/services/types.ts` and returns a
`Result` instead of throwing, so callers must handle failure. Concrete engines
are bound in one place -- `src/services/service-registry.ts`. Features import
`services` from `@/services`, never a concrete module, which is what makes the
online/offline swap and test doubles cheap.

All services currently ship as placeholders that return a `not_implemented`
error. Implementing one means replacing the object in the registry; no feature
code changes.

## Offline-first

- `TranslationRouter` decides per request whether the online or offline engine
  runs, based on connectivity, the `preferOffline` preference and whether a
  language pack is installed.
- `LanguagePackManager` owns the catalogue and download lifecycle of on-device
  models.
- History and preferences persist in SQLite (`src/database`), so the app stays
  usable with no network.

## State

Global state is React Context + `useReducer` -- no state library, because the
shared surface is small (preferences and the language pair). Async state belongs
to whichever feature owns it. If global state grows past a handful of stores,
that is the moment to reach for a library, not before.

## Theming

`useTheme()` is the only styling entry point. It resolves the user's theme
preference against the OS setting and returns colours, spacing, radii, shadows,
typography and motion. Components never hardcode a colour or a font size.
