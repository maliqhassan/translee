import { Platform, StyleSheet } from 'react-native';

export const layout = {
  /** Horizontal gutter used by every screen. */
  screenPadding: 20,
  /** Android/iOS minimum comfortable tap target. */
  minTouchTarget: 44,
  hairline: StyleSheet.hairlineWidth,
  borderWidth: 1,
  tabBarHeight: Platform.select({ ios: 56, default: 60 }),
  maxContentWidth: 720,
  /** Extra touch area for small icon-only controls. */
  iconHitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
} as const;

export const motion = {
  duration: { instant: 90, fast: 150, normal: 220, slow: 320 },
  /** Kept as plain numbers so both Reanimated and Animated can consume them. */
  scalePressed: 0.97,
  opacityPressed: 0.85,
  opacityDisabled: 0.45,
} as const;
