import { FlatList } from 'react-native';

import { Divider, EmptyState, IconButton, Screen, ScreenHeader } from '@/components';
import { useTheme } from '@/hooks';
import type { HistoryEntry } from '@/types';

import { HistoryListItem } from '../components/history-list-item';

/**
 * History shell. Reads from an empty in-memory list today; the repository is
 * connected on the persistence day without touching this component.
 */
export function HistoryScreen() {
  const theme = useTheme();
  const entries: readonly HistoryEntry[] = [];

  return (
    <Screen>
      <ScreenHeader
        title="History"
        subtitle="Your saved translations"
        actions={
          <IconButton
            name="search-outline"
            accessibilityLabel="Search history"
            disabled={entries.length === 0}
          />
        }
      />
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <Divider inset={theme.spacing.base} />}
        contentContainerStyle={entries.length === 0 ? { flexGrow: 1 } : undefined}
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="No translations yet"
            description="Translations you make will be saved here so you can find them again offline."
          />
        }
        renderItem={({ item }) => <HistoryListItem entry={item} />}
      />
    </Screen>
  );
}
