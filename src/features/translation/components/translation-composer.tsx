import { View } from 'react-native';

import { Card, IconButton, Input, Text } from '@/components';
import { DEFAULTS } from '@/constants';
import { useTheme } from '@/hooks';

export type TranslationComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  placeholder?: string;
};

/** The text entry surface on the translate screen. Presentational only. */
export function TranslationComposer({
  value,
  onChangeText,
  onClear,
  placeholder = 'Enter text to translate',
}: TranslationComposerProps) {
  const theme = useTheme();

  return (
    <Card variant="outlined" padding="md" style={{ gap: theme.spacing.sm }}>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline
        maxLength={DEFAULTS.maxInputLength}
        variant="bare"
        containerStyle={{ gap: 0 }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="caption" color="textMuted">
          {value.length} / {DEFAULTS.maxInputLength}
        </Text>
        {value.length > 0 ? (
          <IconButton
            name="close-circle-outline"
            accessibilityLabel="Clear text"
            onPress={onClear}
          />
        ) : null}
      </View>
    </Card>
  );
}
