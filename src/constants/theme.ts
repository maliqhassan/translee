import { darkColors, lightColors, type ColorTokens } from './colors';
import { layout, motion } from './layout';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { fontFamily, fontSize, fontWeight, textVariants } from './typography';

export type ColorSchemeName = 'light' | 'dark';

/** The single object every component receives from `useTheme()`. */
export type Theme = {
  scheme: ColorSchemeName;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
  layout: typeof layout;
  motion: typeof motion;
  typography: {
    fontFamily: typeof fontFamily;
    fontSize: typeof fontSize;
    fontWeight: typeof fontWeight;
    variants: typeof textVariants;
  };
};

const shared = {
  spacing,
  radius,
  shadows,
  layout,
  motion,
  typography: { fontFamily, fontSize, fontWeight, variants: textVariants },
} as const;

export const lightTheme: Theme = { scheme: 'light', colors: lightColors, ...shared };
export const darkTheme: Theme = { scheme: 'dark', colors: darkColors, ...shared };

export const themes: Record<ColorSchemeName, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};
