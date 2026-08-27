/**
 * Raw colour scales. These are the only place literal colour values live.
 * Never reference the palette directly from a component — use the semantic
 * theme tokens exposed by `useTheme()` instead, so light/dark both work.
 */

export const palette = {
  /** Brand — a calm indigo used for primary actions and focus states. */
  indigo: {
    50: '#EEF0FE',
    100: '#DFE3FD',
    200: '#C3CAFB',
    300: '#9FA8F7',
    400: '#7C83F1',
    500: '#5A5FE6',
    600: '#4A46D1',
    700: '#3D38AC',
    800: '#33308B',
    900: '#2B2A6E',
  },
  /** Accent — teal, reserved for offline/ready affordances. */
  teal: {
    50: '#E6FAF7',
    100: '#C4F3EC',
    300: '#68DCCC',
    500: '#18B79F',
    600: '#0E937F',
    700: '#0C7566',
  },
  /** Neutrals — slightly cool greys so surfaces read as "paper", not concrete. */
  neutral: {
    0: '#FFFFFF',
    50: '#F7F8FA',
    100: '#F0F2F5',
    200: '#E3E6EC',
    300: '#CDD2DB',
    400: '#9BA3B2',
    500: '#6E7787',
    600: '#525A69',
    700: '#3B4250',
    800: '#252B36',
    850: '#1B202A',
    900: '#14181F',
    950: '#0B0C10',
  },
  green: { 100: '#DCF7E3', 500: '#1CA45B', 600: '#15854A' },
  amber: { 100: '#FDF0D5', 500: '#D98E12', 600: '#B4730B' },
  red: { 100: '#FDE4E4', 500: '#DB4545', 600: '#B93636' },
} as const;
