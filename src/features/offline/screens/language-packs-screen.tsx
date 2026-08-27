import { FlatList } from 'react-native';

import { Divider, EmptyState, Screen, ScreenHeader } from '@/components';
import { useTheme } from '@/hooks';
import type { LanguagePack } from '@/services';

import { LanguagePackItem } from '../components/language-pack-item';

/**
 * Offline language pack management. The catalogue comes from
 * `services.languagePacks` once that manager is implemented.
 */
export function LanguagePacksScreen() {
  const theme = useTheme();
  const packs: readonly LanguagePack[] = [];

  return (
    <Screen>
      <ScreenHeader
        title="Offline packs"
        subtitle="Download languages to translate without a connection"
      />
      <FlatList
        data={packs}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <Divider inset={theme.spacing.base} />}
        contentContainerStyle={packs.length === 0 ? { flexGrow: 1 } : undefined}
        ListEmptyComponent={
          <EmptyState
            icon="cloud-download-outline"
            title="No packs available yet"
            description="The offline catalogue appears here once language packs are enabled."
          />
        }
        renderItem={({ item }) => <LanguagePackItem pack={item} />}
      />
    </Screen>
  );
}
