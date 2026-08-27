import { Platform, type TextStyle } from 'react-native';

export const fontFamily = Platform.select({
  ios: { sans: 'System', mono: 'Menlo' },
  android: { sans: 'sans-serif', mono: 'monospace' },
  default: { sans: 'System', mono: 'monospace' },
});

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  display: 36,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/**
 * Named text styles. Components take a `variant` rather than raw font props so
 * that type scale changes stay in one place.
 */
export const textVariants = {
  display: {
    fontSize: fontSize.display,
    lineHeight: 42,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.6,
  },
  h1: { fontSize: fontSize.xxl, lineHeight: 36, fontWeight: fontWeight.bold, letterSpacing: -0.4 },
  h2: {
    fontSize: fontSize.xl,
    lineHeight: 30,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: fontSize.lg,
    lineHeight: 26,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  bodyLarge: { fontSize: fontSize.md, lineHeight: 25, fontWeight: fontWeight.regular },
  body: { fontSize: fontSize.base, lineHeight: 22, fontWeight: fontWeight.regular },
  bodySmall: { fontSize: fontSize.sm, lineHeight: 19, fontWeight: fontWeight.regular },
  label: { fontSize: fontSize.sm, lineHeight: 18, fontWeight: fontWeight.semibold },
  button: { fontSize: fontSize.base, lineHeight: 20, fontWeight: fontWeight.semibold },
  caption: {
    fontSize: fontSize.xs,
    lineHeight: 15,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
  },
  /** Free text the user is typing / has captured. */
  sourceText: { fontSize: fontSize.lg, lineHeight: 28, fontWeight: fontWeight.regular },
  /** The translated output — deliberately the loudest text on screen. */
  translatedText: { fontSize: fontSize.lg, lineHeight: 28, fontWeight: fontWeight.medium },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
