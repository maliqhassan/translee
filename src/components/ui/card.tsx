import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import type { ShadowToken, SpacingToken } from '@/constants';
import { useTheme } from '@/hooks';

export type CardVariant = 'elevated' | 'outlined' | 'filled';

export type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  padding?: SpacingToken;
  elevation?: ShadowToken;
  style?: ViewStyle;
};

/** Surface primitive. Every panel in the app is a Card so radii stay consistent. */
export function Card({
  children,
  variant = 'elevated',
  padding = 'base',
  elevation = 'sm',
  style,
}: CardProps) {
  const theme = useTheme();

  const variants: Record<CardVariant, ViewStyle> = {
    elevated: {
      backgroundColor: theme.colors.surface,
      ...theme.shadows[elevation],
      shadowColor: theme.colors.shadow,
    },
    outlined: {
      backgroundColor: theme.colors.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
    },
    filled: { backgroundColor: theme.colors.surfaceMuted },
  };

  return (
    <View
      style={[
        { borderRadius: theme.radius.lg, padding: theme.spacing[padding] },
        variants[variant],
        style,
      ]}
    >
      {children}
    </View>
  );
}
