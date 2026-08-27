import { useState } from 'react';
import { TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks';

import { Text } from './text';

/** Derived from TextInputProps so the handlers stay correct across RN versions. */
type FocusHandler = NonNullable<TextInputProps['onFocus']>;
type BlurHandler = NonNullable<TextInputProps['onBlur']>;

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  helperText?: string;
  errorText?: string;
  /** `bare` drops the border and background for use inside an existing surface. */
  variant?: 'default' | 'bare';
  /** Grows to fill the parent — used by the translate composer. */
  fill?: boolean;
  containerStyle?: ViewStyle;
};

export function Input({
  label,
  helperText,
  errorText,
  variant = 'default',
  fill = false,
  containerStyle,
  multiline,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorText);

  const handleFocus: FocusHandler = (event) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur: BlurHandler = (event) => {
    setFocused(false);
    onBlur?.(event);
  };

  const borderColor = hasError
    ? theme.colors.danger
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={[fill && { flex: 1 }, { gap: theme.spacing.sm }, containerStyle]}>
      {label ? (
        <Text variant="label" color="textSecondary">
          {label}
        </Text>
      ) : null}

      <TextInput
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.primary}
        onFocus={handleFocus}
        onBlur={handleBlur}
        accessibilityLabel={label}
        style={[
          theme.typography.variants[multiline ? 'sourceText' : 'body'],
          {
            flex: fill ? 1 : undefined,
            minHeight: multiline ? 96 : theme.layout.minTouchTarget,
            color: theme.colors.text,
          },
          variant === 'default' && {
            backgroundColor: theme.colors.surface,
            borderWidth: theme.layout.borderWidth,
            borderColor,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.spacing.base,
            paddingVertical: theme.spacing.md,
          },
        ]}
        {...rest}
      />

      {hasError || helperText ? (
        <Text variant="caption" color={hasError ? 'danger' : 'textMuted'}>
          {errorText ?? helperText}
        </Text>
      ) : null}
    </View>
  );
}
