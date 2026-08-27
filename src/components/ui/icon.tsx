import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { ColorTokens } from '@/constants';
import { useTheme } from '@/hooks';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type IconProps = {
  name: IconName;
  size?: number;
  color?: keyof ColorTokens;
};

/**
 * Wrapper around the icon set so the whole app can change icon libraries in
 * one file, and so icon colours come from theme tokens.
 */
export function Icon({ name, size = 20, color = 'text' }: IconProps) {
  const theme = useTheme();
  return <Ionicons name={name} size={size} color={theme.colors[color]} />;
}
