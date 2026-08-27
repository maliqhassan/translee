# Design system

Clean, quiet, and built from tokens. The rule: **components take tokens, never
raw values.** If a value is missing, add a token rather than inlining it.

## Tokens (`src/constants`)

| File            | Provides                                                       |
| --------------- | -------------------------------------------------------------- |
| `palette.ts`    | Raw colour scales. The only file with literal colours.         |
| `colors.ts`     | Semantic tokens (`background`, `text`, `primary`) x light/dark |
| `typography.ts` | Font sizes, weights and named `textVariants`                   |
| `spacing.ts`    | 4pt scale: `xs` 4 through `huge` 56                            |
| `radius.ts`     | `sm` 6 through `xxl` 28, plus `full`                           |
| `shadows.ts`    | Platform-aware elevation presets                               |
| `layout.ts`     | Gutters, touch targets, tab bar height, motion constants       |

Light and dark implement the same `ColorTokens` key set, so a component is
written once and is correct in both.

## Components (`src/components`)

**Primitives (`ui/`)**

- `Text` -- typography via `variant`, colour via a token key
- `Button` -- primary / secondary / ghost / danger, in sm / md / lg, with a loading state
- `IconButton` -- icon-only control; `accessibilityLabel` is required
- `Icon` -- wraps the icon set so it can be swapped in one file
- `Card` -- elevated / outlined / filled
- `Input` -- label, helper and error text; `bare` variant for use inside a card
- `Badge` -- status pill (Offline, Installed, and so on)
- `ListItem` -- the row used by settings, pickers and history
- `Divider`, `SectionHeader`
- `Spinner`, `LoadingState`, `LoadingOverlay`, `Skeleton`
- `EmptyState` -- icon, title, description, optional action

**Layout (`layout/`)**

- `Screen` -- safe areas, background, gutter, optional scrolling
- `ScreenHeader` -- large in-page title with optional actions

## Conventions

- Layout that never changes goes in `StyleSheet.create`; themed values are
  applied inline from `useTheme()`.
- Minimum touch target is 44dp (`layout.minTouchTarget`).
- Every interactive element carries an accessibility role and label.
- Loading and empty are first-class states, not afterthoughts. A screen with no
  data should still look finished.
