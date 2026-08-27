import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/hooks';

import { Text } from '../ui/text';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Trailing controls, e.g. an IconButton. */
  actions?: ReactNode;
};

/** Large in-page title used instead of a native navigation bar on tab roots. */
export function ScreenHeader({ title, subtitle, actions }: ScreenHeaderProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.base,
      }}
    >
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="h1">{title}</Text>
        {subtitle ? (
          <Text variant="bodySmall" color="textSecondary">
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
