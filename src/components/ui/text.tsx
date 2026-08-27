import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import type { ColorTokens, TextVariant } from '@/constants';
import { useTheme } from '@/hooks';

/** Colour token keys that make sense for text. */
export type TextColor = Extract<
  keyof ColorTokens,
  | 'text'
  | 'textSecondary'
  | 'textMuted'
  | 'textOnPrimary'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
>;

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: TextColor;
  align?: TextStyle['textAlign'];
};

/**
 * Typography primitive. Screens should never set `fontSize` directly — add a
 * variant in `constants/typography.ts` instead.
 */
export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      style={[
        theme.typography.variants[variant],
        { color: theme.colors[color], textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}
