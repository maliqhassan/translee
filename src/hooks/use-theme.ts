import { useColorScheme } from 'react-native';

import { themes, type ColorSchemeName, type Theme } from '@/constants';
import { usePreferences } from '@/store';

/** Resolves the user's theme preference against the OS setting. */
export function useColorSchemeName(): ColorSchemeName {
  const system = useColorScheme();
  const { preferences } = usePreferences();
  if (preferences.theme !== 'system') return preferences.theme;
  return system === 'dark' ? 'dark' : 'light';
}

/**
 * The one hook every component uses for styling. Returning the whole theme
 * (not just colours) keeps spacing and radii out of component literals.
 */
export function useTheme(): Theme {
  return themes[useColorSchemeName()];
}
