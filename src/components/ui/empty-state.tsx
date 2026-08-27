import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks';

import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Tightens padding for use inside a card rather than a whole screen. */
  compact?: boolean;
  style?: ViewStyle;
};

/**
 * Used for "nothing here yet", "no results" and not-yet-available states alike,
 * so empty screens never look broken.
 */
export function EmptyState({
  icon = 'sparkles-outline',
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  style,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          flex: compact ? undefined : 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.md,
          paddingVertical: compact ? theme.spacing.xl : theme.spacing.huge,
          paddingHorizontal: theme.spacing.xl,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 56,
          height: 56,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.primaryMuted,
        }}
      >
        <Icon name={icon} size={26} color="primary" />
      </View>

      <Text variant="h3" align="center">
        {title}
      </Text>

      {description ? (
        <Text variant="bodySmall" color="textSecondary" align="center" style={{ maxWidth: 320 }}>
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" size="sm" />
      ) : null}
    </View>
  );
}
