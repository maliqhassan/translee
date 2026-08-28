import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Switch, View } from 'react-native';

import { Card, Divider, ListItem, Screen, ScreenHeader, SectionHeader, Text } from '@/components';
import { APP, isAutoDetect, languageName } from '@/constants';
import { useHistoryActions } from '@/features/history';
import { useTheme } from '@/hooks';
import { useLanguagePair, usePreferences } from '@/store';
import type { BooleanPreference, ThemePreference, TranslationMode } from '@/types';

/** Cycled in order, so one tap moves to the next option. */
const THEME_ORDER: readonly ThemePreference[] = ['system', 'light', 'dark'];
const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Match system',
  light: 'Light',
  dark: 'Dark',
};

const MODE_ORDER: readonly TranslationMode[] = ['auto', 'online', 'offline'];
const MODE_LABELS: Record<TranslationMode, string> = {
  auto: 'Automatic',
  online: 'Online only',
  offline: 'On-device only',
};
const MODE_HINTS: Record<TranslationMode, string> = {
  auto: 'Use the best engine available',
  online: 'Never use an on-device model',
  // Said plainly rather than offering a switch that quietly does nothing.
  offline: 'Not available yet — no language packs',
};

/** Steps to the next value in a fixed list, wrapping at the end. */
function next<T>(order: readonly T[], current: T, fallback: T): T {
  return order[(order.indexOf(current) + 1) % order.length] ?? fallback;
}

export function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { preferences, update, toggle, reset, saveError } = usePreferences();
  const { pair } = useLanguagePair();
  const { clear } = useHistoryActions();

  const openPicker = (field: 'source' | 'target') => {
    router.push({ pathname: '/translate/language-picker', params: { field } });
  };

  const confirmReset = useCallback(() => {
    Alert.alert(
      'Reset settings?',
      'Languages, translation mode and appearance go back to their defaults. Your saved translations are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: reset },
      ],
    );
  }, [reset]);

  const confirmClearHistory = useCallback(() => {
    Alert.alert(
      'Clear translation history?',
      'This permanently deletes every saved translation on this device, including favourites.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear all', style: 'destructive', onPress: () => void clear() },
      ],
    );
  }, [clear]);

  const renderSwitch = (key: BooleanPreference, label: string) => (
    <Switch
      value={preferences[key]}
      onValueChange={() => toggle(key)}
      accessibilityLabel={label}
      trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
      thumbColor={theme.colors.surface}
    />
  );

  return (
    <Screen scrollable header={<ScreenHeader compact title="Settings" />}>
      {saveError ? (
        <Card variant="outlined">
          <Text variant="bodySmall" color="warning">
            Settings changed, but could not be saved. They may not survive a restart.
          </Text>
        </Card>
      ) : null}

      <View>
        <SectionHeader title="Translation" />
        <Card variant="outlined" padding="none">
          <ListItem
            icon="language-outline"
            title="Translate from"
            subtitle={
              isAutoDetect(pair.source)
                ? 'Detect language automatically'
                : languageName(pair.source)
            }
            onPress={() => openPicker('source')}
          />
          <Divider inset={theme.spacing.base} />
          <ListItem
            icon="arrow-forward-outline"
            title="Translate to"
            subtitle={languageName(pair.target)}
            onPress={() => openPicker('target')}
          />
          <Divider inset={theme.spacing.base} />
          <ListItem
            icon="git-branch-outline"
            title="Translation mode"
            subtitle={MODE_HINTS[preferences.translationMode]}
            onPress={() =>
              update({
                translationMode: next(MODE_ORDER, preferences.translationMode, 'auto'),
              })
            }
            showChevron={false}
            accessibilityLabel={`Translation mode, currently ${MODE_LABELS[preferences.translationMode]}`}
            accessibilityHint="Cycles between automatic, online only and on-device only"
            trailing={
              <Text variant="body" color="textSecondary">
                {MODE_LABELS[preferences.translationMode]}
              </Text>
            }
          />
        </Card>
      </View>

      <View>
        <SectionHeader title="Appearance" />
        <Card variant="outlined" padding="none">
          <ListItem
            icon="contrast-outline"
            title="Theme"
            onPress={() => update({ theme: next(THEME_ORDER, preferences.theme, 'system') })}
            showChevron={false}
            accessibilityLabel={`Theme, currently ${THEME_LABELS[preferences.theme]}`}
            accessibilityHint="Cycles between matching the system, light and dark"
            trailing={
              <Text variant="body" color="textSecondary">
                {THEME_LABELS[preferences.theme]}
              </Text>
            }
          />
        </Card>
      </View>

      <View>
        <SectionHeader title="Data" description="Everything stays on this device." />
        <Card variant="outlined" padding="none">
          <ListItem
            icon="time-outline"
            title="Save history"
            subtitle="Keep a record of the translations you make"
            trailing={renderSwitch('saveHistory', 'Save history')}
          />
          <Divider inset={theme.spacing.base} />
          <ListItem
            icon="trash-outline"
            title="Clear translation history"
            subtitle="Deletes every saved translation and favourite"
            onPress={confirmClearHistory}
            destructive
          />
        </Card>
      </View>

      <View>
        <SectionHeader title="About" />
        <Card variant="outlined" padding="none">
          <ListItem
            icon="information-circle-outline"
            title="Version"
            showChevron={false}
            trailing={
              <Text variant="body" color="textSecondary">
                {APP.version}
              </Text>
            }
          />
          <Divider inset={theme.spacing.base} />
          <ListItem
            icon="lock-closed-outline"
            title="Privacy"
            subtitle="Translations and settings are stored only on this device and are never uploaded."
            showChevron={false}
          />
          <Divider inset={theme.spacing.base} />
          <ListItem
            icon="refresh-outline"
            title="Reset settings"
            subtitle="Restore the default languages, mode and appearance"
            onPress={confirmReset}
            destructive
          />
        </Card>
      </View>

      <Text variant="caption" color="textMuted" align="center">
        {APP.name}
      </Text>
    </Screen>
  );
}
