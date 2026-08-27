import { useWindowDimensions } from 'react-native';

export type Responsive = {
  width: number;
  height: number;
  /** The OS text-size setting, where 1 is the default. */
  fontScale: number;
  /** Short devices — trim vertical breathing room so the fold still works. */
  isShort: boolean;
  /** Narrow devices — tighten horizontal padding and truncate sooner. */
  isNarrow: boolean;
  /** Large accessibility text — prefer stacked layouts over side-by-side. */
  isLargeText: boolean;
};

/**
 * One place for the size breakpoints, so screens do not each invent their own.
 * Thresholds are in dp and chosen against common Android hardware: a 5" phone
 * is around 640dp tall, a 6.7" phone around 900dp.
 */
export function useResponsive(): Responsive {
  const { width, height, fontScale } = useWindowDimensions();

  return {
    width,
    height,
    fontScale,
    isShort: height < 700,
    isNarrow: width < 360,
    isLargeText: fontScale >= 1.3,
  };
}
