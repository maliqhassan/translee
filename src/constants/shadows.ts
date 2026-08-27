import { Platform, type ViewStyle } from 'react-native';

/**
 * Elevation presets. `shadowColor` is intentionally omitted — callers merge in
 * the themed shadow colour so dark mode can use a deeper shadow.
 */
type Elevation = Omit<ViewStyle, 'shadowColor'>;

export const shadows = {
  none: {} as Elevation,
  sm: Platform.select<Elevation>({
    android: { elevation: 1 },
    default: { shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  }),
  md: Platform.select<Elevation>({
    android: { elevation: 3 },
    default: { shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  }),
  lg: Platform.select<Elevation>({
    android: { elevation: 8 },
    default: { shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  }),
} as const;

export type ShadowToken = keyof typeof shadows;
