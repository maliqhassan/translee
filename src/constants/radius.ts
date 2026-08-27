/** Corner radii. Cards use `lg`, controls use `md`, pills use `full`. */
export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  xxl: 28,
  full: 999,
} as const;

export type RadiusToken = keyof typeof radius;
