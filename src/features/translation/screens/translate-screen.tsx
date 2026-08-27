import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Badge, Button, Screen, ScreenHeader } from '@/components';
import { APP, FEATURES } from '@/constants';
import { useTheme } from '@/hooks';
import { useLanguagePair } from '@/store';
import type { AsyncStatus } from '@/types';

import { LanguageBar, type LanguageField } from '../components/language-bar';
import { TranslationComposer } from '../components/translation-composer';
import { TranslationResultCard } from '../components/translation-result-card';

/**
 * Home screen. Composition only — the translate action is deliberately inert
 * until an engine is registered in the service registry.
 */
export function TranslateScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { pair, canSwap, swap } = useLanguagePair();

  const [text, setText] = useState('');
  const [status] = useState<AsyncStatus>('idle');

  const openPicker = (field: LanguageField) => {
    router.push({ pathname: '/translate/language-picker', params: { field } });
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScreenHeader
          title={APP.name}
          subtitle={APP.tagline}
          actions={
            <Badge
              label={FEATURES.offlineTranslation ? 'Offline ready' : 'Setup'}
              tone={FEATURES.offlineTranslation ? 'accent' : 'neutral'}
              icon="cloud-offline-outline"
            />
          }
        />

        <View style={{ flex: 1, gap: theme.spacing.base }}>
          <LanguageBar
            source={pair.source}
            target={pair.target}
            canSwap={canSwap}
            onSelect={openPicker}
            onSwap={swap}
          />

          <TranslationComposer value={text} onChangeText={setText} onClear={() => setText('')} />

          <TranslationResultCard status={status} />

          <Button
            label="Translate"
            icon="language-outline"
            fullWidth
            disabled={text.trim().length === 0}
            onPress={() => {
              // Wired to the translation router once an engine is implemented.
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
