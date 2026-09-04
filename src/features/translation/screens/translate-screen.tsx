import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, IconButton, Screen, ScreenHeader } from '@/components';
import { APP } from '@/constants';
import { RecentTranslations } from '@/features/history';
import { OfflineReadinessNotice, offlineNotice, useOfflineReadiness } from '@/features/offline';
import { useTheme } from '@/hooks';
import { useLanguagePair, usePreferences, type LanguageField } from '@/store';
import type { AppError } from '@/types';

import { BrandMark } from '../components/brand-mark';
import { LanguageBar } from '../components/language-bar';
import { TranslationComposer } from '../components/translation-composer';
import { TranslationResultCard } from '../components/translation-result-card';
import { useCopyToClipboard } from '../hooks/use-copy-to-clipboard';
import { usePasteFromClipboard } from '../hooks/use-paste-from-clipboard';
import { useSpeak } from '../hooks/use-speak';
import { useTranslation } from '../hooks/use-translation';

/**
 * Home screen and the primary surface of the app.
 *
 * Composition only: the language pair comes from the language store, the
 * translation lifecycle from `useTranslation`, and the engine is reached
 * through the service registry's router.
 */
export function TranslateScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { pair, canSwap, swap } = useLanguagePair();
  const { preferences } = usePreferences();
  const { input, setInput, clearInput, state, canTranslate, translate, reset } = useTranslation();

  const copy = useCopyToClipboard();
  const paste = usePasteFromClipboard(setInput);
  const speak = useSpeak();

  const isTranslating = state.status === 'loading';

  // Only in on-device mode: in automatic and online, a missing pack is not
  // something the user needs to act on, and saying so would be noise.
  const { readiness } = useOfflineReadiness(preferences.translationMode === 'offline');

  /**
   * Only these two codes can mean "something is missing on the device". Every
   * other failure keeps its generic message, so a network timeout never turns
   * into an invitation to download a language pack.
   */
  const offlineDetail = (error: AppError) =>
    readiness && (error.code === 'model_missing' || error.code === 'unsupported_language')
      ? offlineNotice(readiness)
      : undefined;

  const openPicker = (field: LanguageField) => {
    router.push({ pathname: '/translate/language-picker', params: { field } });
  };

  return (
    <Screen
      scrollable
      keyboardAvoiding
      header={
        <ScreenHeader
          compact
          title={APP.name}
          leading={<BrandMark />}
          actions={
            <IconButton
              name="settings-outline"
              accessibilityLabel="Open settings"
              onPress={() => router.push('/settings')}
            />
          }
        />
      }
    >
      <LanguageBar
        source={pair.source}
        target={pair.target}
        canSwap={canSwap}
        onSelect={openPicker}
        onSwap={swap}
      />

      <OfflineReadinessNotice readiness={readiness} />

      <View style={{ gap: theme.spacing.md }}>
        <TranslationComposer
          value={input}
          onChangeText={setInput}
          onClear={clearInput}
          onPaste={paste}
          sourceLanguage={pair.source}
          editable={!isTranslating}
        />

        <Button
          label="Translate"
          icon="arrow-forward"
          iconPosition="right"
          size="lg"
          fullWidth
          loading={isTranslating}
          disabled={!canTranslate}
          onPress={translate}
          accessibilityHint="Translates the text you entered"
        />
      </View>

      <TranslationResultCard
        state={state}
        targetLanguage={pair.target}
        copy={copy}
        onClear={reset}
        onRetry={translate}
        offlineDetail={offlineDetail}
        onOpenPacks={() => router.push('/settings/language-packs')}
        speak={speak}
      />

      <RecentTranslations />
    </Screen>
  );
}
