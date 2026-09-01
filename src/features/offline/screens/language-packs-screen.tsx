import { useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';

import { Card, Divider, EmptyState, IconButton, Screen, ScreenHeader, Text } from '@/components';
import { useTheme } from '@/hooks';
import type { LanguagePack } from '@/services';

import { LanguagePackItem } from '../components/language-pack-item';
import { useLanguagePacks } from '../hooks/use-language-packs';

/**
 * Managing the on-device language models.
 *
 * Every language shown here is one the runtime reported it can serve, so a
 * language cannot appear merely because the catalogue contains it. Downloads
 * happen only when the user taps one: nothing is fetched on entering the
 * screen, and translating never triggers a download.
 */
export function LanguagePacksScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { available, loading, packs, error, actionError, download, remove } = useLanguagePacks();

  const downloaded = packs.filter((pack) => pack.state === 'ready').length;

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Language Packs"
        subtitle="Download a language to translate it without a connection"
        leading={
          <IconButton
            name="chevron-back-outline"
            accessibilityLabel="Back to settings"
            onPress={() => router.back()}
          />
        }
      />

      {actionError ? (
        <Card variant="outlined">
          <Text variant="bodySmall" color="danger">
            {actionError.message}
          </Text>
        </Card>
      ) : null}

      <FlatList
        data={available ? packs : []}
        keyExtractor={(item) => item.modelId}
        ItemSeparatorComponent={() => <Divider inset={theme.spacing.base} />}
        contentContainerStyle={packs.length === 0 ? { flexGrow: 1 } : undefined}
        ListHeaderComponent={
          available && packs.length > 0 ? (
            <View style={{ paddingBottom: theme.spacing.sm }}>
              <Text variant="bodySmall" color="textSecondary">
                A pack covers one language. Download both sides of a pair — English and German, say
                — to translate between them in either direction.
              </Text>
              <Text variant="caption" color="textMuted">
                {downloaded} of {packs.length} downloaded
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <PacksEmptyState available={available} loading={loading} hasError={Boolean(error)} />
        }
        renderItem={({ item }: { item: LanguagePack }) => (
          <LanguagePackItem pack={item} onDownload={onPress(download)} onRemove={onPress(remove)} />
        )}
      />
    </Screen>
  );
}

const onPress = (action: (modelId: string) => void) => (pack: LanguagePack) => action(pack.modelId);

/**
 * The three ways this list can be empty, said plainly.
 *
 * "No runtime in this build" is the common one and is not an error: a bundle
 * without the native module degrades to an engine that reports itself absent,
 * and saying so is more useful than an empty list.
 */
function PacksEmptyState({
  available,
  loading,
  hasError,
}: {
  available: boolean;
  loading: boolean;
  hasError: boolean;
}) {
  if (loading) {
    return <EmptyState icon="cloud-download-outline" title="Checking for language packs" />;
  }

  if (!available) {
    return (
      <EmptyState
        icon="phone-portrait-outline"
        title="On-device translation is not in this build"
        description="Language packs need the native translation module, which is only present in a development or release build of the app."
      />
    );
  }

  if (hasError) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Could not read the language packs"
        description="The on-device model list was unavailable. Try again in a moment."
      />
    );
  }

  return (
    <EmptyState
      icon="cloud-download-outline"
      title="No language packs available"
      description="The on-device runtime reported no languages it can translate."
    />
  );
}
