import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, View } from 'react-native';

import {
  Divider,
  EmptyState,
  IconButton,
  LoadingState,
  Screen,
  ScreenHeader,
  SearchField,
} from '@/components';
import { useTheme } from '@/hooks';
import type { HistoryEntry } from '@/types';

import { HistoryListItem } from '../components/history-list-item';
import { useHistoryActions, useHistoryList } from '../hooks/use-history';

/**
 * The full history list, backed by SQLite.
 *
 * Searching and ordering are done by the database, so this screen never holds
 * more than a page of rows and never sorts anything itself.
 */
export function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const history = useHistoryList(search);
  const { toggleFavorite, remove, clear } = useHistoryActions();

  const entries = history.status === 'success' ? history.data : [];
  const isSearching = search.trim().length > 0;

  const open = useCallback(
    (entry: HistoryEntry) => {
      router.push({ pathname: '/history/[id]', params: { id: entry.id } });
    },
    [router],
  );

  const confirmClear = useCallback(() => {
    Alert.alert(
      'Clear history?',
      'This permanently deletes every saved translation on this device, including favourites.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear all', style: 'destructive', onPress: () => void clear() },
      ],
    );
  }, [clear]);

  const confirmDelete = useCallback(
    (entry: HistoryEntry) => {
      Alert.alert('Delete translation?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove(entry.id) },
      ]);
    },
    [remove],
  );

  function body() {
    if (history.status === 'loading') return <LoadingState message="Loading history…" />;

    if (history.status === 'error') {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title="History unavailable"
          description="Saved translations cannot be read on this device right now. Translating still works."
        />
      );
    }

    if (entries.length === 0) {
      return isSearching ? (
        <EmptyState
          icon="search-outline"
          title="No matches"
          description={`Nothing in your history matches “${search.trim()}”.`}
        />
      ) : (
        <EmptyState
          icon="time-outline"
          title="No translations yet"
          description="Translations you make are saved here so you can find them again offline."
        />
      );
    }

    return (
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ItemSeparatorComponent={() => <Divider inset={theme.spacing.base} />}
        contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={({ item }) => (
          <HistoryListItem
            entry={item}
            onPress={open}
            onToggleFavorite={(entry) => void toggleFavorite(entry.id)}
            onDelete={confirmDelete}
          />
        )}
      />
    );
  }

  return (
    <Screen
      edgeToEdge
      header={
        <View style={{ paddingHorizontal: theme.layout.screenPadding }}>
          <ScreenHeader
            compact
            title="History"
            subtitle="Saved on this device"
            actions={
              <IconButton
                name="trash-outline"
                accessibilityLabel="Clear all history"
                disabled={history.status !== 'success' || entries.length === 0}
                onPress={confirmClear}
              />
            }
          />
          <SearchField
            value={search}
            onChangeText={setSearch}
            onClear={() => setSearch('')}
            placeholder="Search your translations"
            accessibilityLabel="Search saved translations"
          />
        </View>
      }
    >
      <View style={{ flex: 1, paddingTop: theme.spacing.sm }}>{body()}</View>
    </Screen>
  );
}
