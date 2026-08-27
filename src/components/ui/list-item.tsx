import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/hooks';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export type ListItemProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Trailing slot — a Switch, Badge or plain text value. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Shows a chevron. Defaults to true when `onPress` is provided. */
  showChevron?: boolean;
  destructive?: boolean;
};

/** Row primitive for settings, language pickers and history lists. */
export function ListItem({
  title,
  subtitle,
  icon,
  trailing,
  onPress,
  showChevron,
  destructive = false,
}: ListItemProps) {
  const theme = useTheme();
  const chevron = showChevron ?? (Boolean(onPress) && !trailing);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.layout.minTouchTarget + theme.spacing.md,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.base,
        backgroundColor: pressed && onPress ? theme.colors.surfaceMuted : 'transparent',
      })}
    >
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.sm,
            backgroundColor: destructive ? theme.colors.dangerMuted : theme.colors.surfaceMuted,
          }}
        >
          <Icon name={icon} size={18} color={destructive ? 'danger' : 'textSecondary'} />
        </View>
      ) : null}

      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="body" color={destructive ? 'danger' : 'text'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySmall" color="textMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing}
      {chevron ? <Icon name="chevron-forward" size={18} color="textMuted" /> : null}
    </Pressable>
  );
}
