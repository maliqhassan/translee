import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks';

import { Text } from '../ui/text';

export type GradientHeaderProps = {
  title: string;
  subtitle?: string;
  /** Leading slot, e.g. a brand mark or a back affordance. */
  leading?: ReactNode;
  /** Trailing controls, e.g. an IconButton. */
  actions?: ReactNode;
  /** Extra content below the title, e.g. a segmented control or a search box. */
  children?: ReactNode;
};

/**
 * The brand header: a gradient block that runs to the edges and under the
 * status bar.
 *
 * It pays its own top inset rather than sitting inside a safe area, which is
 * what lets the colour reach the very top of the screen while the text stays
 * clear of the clock and the camera cut-out. Screens using it therefore drop
 * `top` from their own safe-area edges.
 *
 * The gradient is drawn by the platform through React Native's own
 * `experimental_backgroundImage`, so nothing is imported to paint it and there
 * is no image to load or scale.
 */
export function GradientHeader({
  title,
  subtitle,
  leading,
  actions,
  children,
}: GradientHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top + theme.spacing.xs,
        paddingBottom: theme.spacing.md,
        paddingHorizontal: theme.layout.screenPadding,
        gap: theme.spacing.sm,
        borderBottomLeftRadius: theme.radius.xxl,
        borderBottomRightRadius: theme.radius.xxl,
        // A solid colour first, so the header still reads correctly anywhere
        // the gradient cannot be drawn.
        backgroundColor: theme.colors.gradientFrom,
        experimental_backgroundImage: `linear-gradient(160deg, ${theme.colors.gradientFrom} 0%, ${theme.colors.gradientTo} 100%)`,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          minHeight: theme.layout.minTouchTarget,
        }}
      >
        {leading}

        <View style={{ flex: 1 }}>
          <Text variant="h2" color="onGradient" numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          {/* One quiet line at most: the header is chrome, not content. */}
          {subtitle ? (
            <Text variant="caption" color="onGradientMuted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {actions ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            {actions}
          </View>
        ) : null}
      </View>

      {children}
    </View>
  );
}
