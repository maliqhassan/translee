import { useRouter } from 'expo-router';
import { Switch, View } from 'react-native';

import { Card, Divider, ListItem, Screen, ScreenHeader, SectionHeader, Text } from '@/components';
import { APP, getLanguage } from '@/constants';
import { useTheme } from '@/hooks';
import {
  usePreferences,
  useLanguagePair,
  type BooleanPreference,
  type ThemePreference,
} from '@/store';

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Match system',
  light: 'Light',
  dark: 'Dark',
};

const THEME_ORDER: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { preferences, setTheme, toggle } = usePreferences();
  const { pair } = useLanguagePair();

  const cycleTheme = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(preferences.theme) + 1) % THEME_ORDER.length];
    if (next) setTheme(next);
  };

  const renderSwitch = (key: BooleanPreference) => (
    <Switch
      value={preferences[key]}
      onValueChange={() => toggle(key)}
      trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
      thumbColor={theme.colors.surface}
    />
  );

  return (
    <Screen scrollable>
      <ScreenHeader title="Settings" />

      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <SectionHeader title="Languages" />
          <Card variant="outlined" padding="none">
            <ListItem
              icon="language-outline"
              title="Default pair"
              subtitle={`${getLanguage(pair.source)?.name ?? pair.source} → ${getLanguage(pair.target)?.name ?? pair.target}`}
              onPress={() => router.push('/translate/language-picker')}
            />
            <Divider inset={theme.spacing.base} />
            <ListItem
              icon="cloud-download-outline"
              title="Offline packs"
              subtitle="Manage downloaded languages"
              onPress={() => router.push('/settings/language-packs')}
            />
          </Card>
        </View>

        <View>
          <SectionHeader title="Translation" />
          <Card variant="outlined" padding="none">
            <ListItem
              icon="cloud-offline-outline"
              title="Prefer offline"
              subtitle="Use on-device models even when online"
              trailing={renderSwitch('preferOffline')}
            />
            <Divider inset={theme.spacing.base} />
            <ListItem
              icon="volume-medium-outline"
              title="Speak results"
              subtitle="Read each translation aloud automatically"
              trailing={renderSwitch('autoSpeakResult')}
            />
            <Divider inset={theme.spacing.base} />
            <ListItem
              icon="time-outline"
              title="Save history"
              subtitle="Keep translations on this device"
              trailing={renderSwitch('saveHistory')}
            />
          </Card>
        </View>

        <View>
          <SectionHeader title="Downloads" />
          <Card variant="outlined" padding="none">
            <ListItem
              icon="wifi-outline"
              title="Wi-Fi only"
              subtitle="Never download packs on mobile data"
              trailing={renderSwitch('downloadOverWifiOnly')}
            />
          </Card>
        </View>

        <View>
          <SectionHeader title="Appearance" />
          <Card variant="outlined" padding="none">
            <ListItem
              icon="contrast-outline"
              title="Theme"
              onPress={cycleTheme}
              showChevron={false}
              trailing={
                <Text variant="body" color="textSecondary">
                  {THEME_LABELS[preferences.theme]}
                </Text>
              }
            />
          </Card>
        </View>

        <Text variant="caption" color="textMuted" align="center">
          {APP.name} · v0.1.0
        </Text>
      </View>
    </Screen>
  );
}
