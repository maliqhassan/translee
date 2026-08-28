# Conventions

## Files and naming

- Files are `kebab-case.ts(x)`; components and types are `PascalCase`; hooks are
  `useThing` in `use-thing.ts`.
- Each folder exposes a barrel `index.ts`. Import from the barrel
  (`@/components`), not from deep paths.
- The `@/*` alias maps to `src/*`.

## TypeScript

Strict mode plus `noUncheckedIndexedAccess`, `noUnusedLocals`,
`noUnusedParameters` and `verbatimModuleSyntax`.

- Type-only imports must use `import type` (enforced by tsc and ESLint).
- Indexed access returns `T | undefined`. Handle it; do not cast.
- `any` is not used. Prefer `unknown` plus narrowing.

## Errors

Services return `Result<T, AppError>` (see `src/utils/result.ts`) rather than
throwing. Screens branch on `AsyncStatus`, never on ad-hoc booleans.

## Screens

Screens compose components and read stores. They must not contain business
rules, network calls, SQL or platform APIs. Those belong in a service, a
repository or a feature hook.

## Feature flags

Half-built capabilities stay behind a flag in `src/constants/config.ts` so the
main branch is always shippable.

## Tests

`npm test` compiles the app and `tests/` to CommonJS and runs them on Node's
built-in test runner. No test framework is installed: the runner is a script,
and `scripts/test-register.cjs` resolves the `@/` alias and stubs the two
native modules the service layer imports.

Tests import the real modules. Where a boundary has to be faked it is faked at
a seam the production code already has -- an injected `fetchImpl`, an
`HttpClient`, a `NetworkService` -- never by reimplementing the logic under
test.

## Commands

| Command             | Purpose                                |
| ------------------- | -------------------------------------- |
| `npm start`         | Expo dev server                        |
| `npm run android`   | Build and run on Android               |
| `npm run typecheck` | `tsc --noEmit`                         |
| `npm run lint`      | ESLint                                 |
| `npm run format`    | Prettier write                         |
| `npm test`          | unit tests                             |
| `npm run check`     | typecheck + lint + format check + test |
