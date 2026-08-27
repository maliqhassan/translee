import { palette } from './palette';

/**
 * Semantic colour tokens. Both themes implement the exact same key set, so a
 * component can be written once and stay correct in light and dark.
 */
export type ColorTokens = {
  /** Furthest-back app surface. */
  background: string;
  /** Cards, sheets and anything lifted off the background. */
  surface: string;
  /** Quieter fills: input backgrounds, chips, pressed rows. */
  surfaceMuted: string;
  /** Strongest fill, used for the translation result panel. */
  surfaceStrong: string;

  border: string;
  borderStrong: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  /** Text drawn on top of `primary` / other strong fills. */
  textOnPrimary: string;

  primary: string;
  primaryPressed: string;
  primaryMuted: string;
  primaryBorder: string;

  accent: string;
  accentMuted: string;

  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;

  /** Backdrop behind modals and full-screen loaders. */
  overlay: string;
  /** Skeleton / shimmer base. */
  skeleton: string;
  shadow: string;

  tabBar: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
};

export const lightColors: ColorTokens = {
  background: palette.neutral[50],
  surface: palette.neutral[0],
  surfaceMuted: palette.neutral[100],
  surfaceStrong: palette.neutral[200],

  border: palette.neutral[200],
  borderStrong: palette.neutral[300],

  text: palette.neutral[900],
  textSecondary: palette.neutral[600],
  textMuted: palette.neutral[400],
  textOnPrimary: palette.neutral[0],

  primary: palette.indigo[500],
  primaryPressed: palette.indigo[600],
  primaryMuted: palette.indigo[50],
  primaryBorder: palette.indigo[200],

  accent: palette.teal[600],
  accentMuted: palette.teal[50],

  success: palette.green[600],
  successMuted: palette.green[100],
  warning: palette.amber[600],
  warningMuted: palette.amber[100],
  danger: palette.red[600],
  dangerMuted: palette.red[100],

  overlay: 'rgba(11, 12, 16, 0.45)',
  skeleton: palette.neutral[200],
  shadow: '#0B0C10',

  tabBar: palette.neutral[0],
  tabBarBorder: palette.neutral[200],
  tabBarActive: palette.indigo[600],
  tabBarInactive: palette.neutral[500],
};

export const darkColors: ColorTokens = {
  background: palette.neutral[950],
  surface: palette.neutral[900],
  surfaceMuted: palette.neutral[850],
  surfaceStrong: palette.neutral[800],

  border: palette.neutral[800],
  borderStrong: palette.neutral[700],

  text: palette.neutral[50],
  textSecondary: palette.neutral[400],
  textMuted: palette.neutral[500],
  textOnPrimary: palette.neutral[0],

  primary: palette.indigo[400],
  primaryPressed: palette.indigo[300],
  primaryMuted: 'rgba(124, 131, 241, 0.14)',
  primaryBorder: 'rgba(124, 131, 241, 0.32)',

  accent: palette.teal[300],
  accentMuted: 'rgba(104, 220, 204, 0.14)',

  success: palette.green[500],
  successMuted: 'rgba(28, 164, 91, 0.16)',
  warning: palette.amber[500],
  warningMuted: 'rgba(217, 142, 18, 0.16)',
  danger: palette.red[500],
  dangerMuted: 'rgba(219, 69, 69, 0.16)',

  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: palette.neutral[800],
  shadow: '#000000',

  tabBar: palette.neutral[900],
  tabBarBorder: palette.neutral[800],
  tabBarActive: palette.indigo[300],
  tabBarInactive: palette.neutral[500],
};
