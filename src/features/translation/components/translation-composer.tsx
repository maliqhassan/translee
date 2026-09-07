import { View } from 'react-native';

import { Button, Card, IconButton, Input, Text } from '@/components';
import { DEFAULTS, getLanguage } from '@/constants';
import { useResponsive, useTheme } from '@/hooks';
import type { LanguageCode } from '@/types';

import type { SpeechController } from '../hooks/use-speech-recognition';

export type TranslationComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  onPaste: () => void;
  sourceLanguage: LanguageCode;
  /** Disables editing while a request is in flight. */
  editable?: boolean;
  placeholder?: string;
  /**
   * Dictation. Omitted, or reporting itself unavailable, hides the microphone
   * entirely rather than showing a control that cannot work.
   */
  speech?: SpeechController;
};

const WARNING_AT = Math.floor(DEFAULTS.maxInputLength * DEFAULTS.inputWarningRatio);

/**
 * The text entry surface on the translate screen. Presentational: it reports
 * changes upward and holds no draft state of its own.
 */
export function TranslationComposer({
  value,
  onChangeText,
  onClear,
  onPaste,
  sourceLanguage,
  editable = true,
  placeholder = 'Type something…',
  speech,
}: TranslationComposerProps) {
  const theme = useTheme();
  const { isShort } = useResponsive();

  const hasText = value.length > 0;
  const nearLimit = value.length >= WARNING_AT;
  const languageName = getLanguage(sourceLanguage)?.name ?? sourceLanguage;

  return (
    <Card variant="outlined" padding="md" style={{ gap: theme.spacing.xs }}>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={editable}
        multiline
        scrollEnabled
        maxLength={DEFAULTS.maxInputLength}
        variant="bare"
        containerStyle={{ gap: 0 }}
        accessibilityLabel={`Text to translate, in ${languageName}`}
        accessibilityHint="Enter the text you want translated"
        // Short devices give the keyboard room; taller ones get a roomier field.
        inputStyle={{ minHeight: isShort ? 92 : 128 }}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          minHeight: theme.layout.minTouchTarget,
        }}
      >
        {hasText ? (
          <Text
            variant="caption"
            color={nearLimit ? 'warning' : 'textMuted'}
            accessibilityLabel={`${value.length} of ${DEFAULTS.maxInputLength} characters used`}
          >
            {value.length} / {DEFAULTS.maxInputLength}
          </Text>
        ) : (
          <Button
            label="Paste"
            icon="clipboard-outline"
            variant="ghost"
            size="sm"
            onPress={onPaste}
            accessibilityHint="Pastes text from the clipboard"
            style={{ paddingHorizontal: theme.spacing.xs }}
          />
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          {speech && speech.status !== 'unavailable' ? (
            <IconButton
              name={speech.listening ? 'stop-circle' : 'mic-outline'}
              variant={speech.listening ? 'solid' : 'plain'}
              accessibilityLabel={
                speech.listening ? 'Stop listening' : `Dictate in ${languageName}`
              }
              onPress={() => speech.toggle(sourceLanguage)}
            />
          ) : null}

          {hasText ? (
            <IconButton
              name="close-circle"
              size={18}
              accessibilityLabel="Clear the text"
              onPress={onClear}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}
