import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/hooks';

import { Text } from '../ui/text';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Leading slot, e.g. a brand mark or a back affordance. */
  leading?: ReactNode;
  /** Trailing controls, e.g. an IconButton. */
  actions?: ReactNode;
  /** Drops the title to a smaller variant for dense screens. */
  compact?: boolean;
};

/** Large in-page title used instead of a native navigation bar on tab roots. */
export function ScreenHeader({
  title,
  subtitle,
  leading,
  actions,
  compact = false,
}: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingTop: theme.spacing.sm,
        paddingBottom: compact ? theme.spacing.md : theme.spacing.base,
      }}
    >
      {leading}
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant={compact ? 'h2' : 'h1'} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>{actions}</View>
      ) : null}
    </View>
  );
}
