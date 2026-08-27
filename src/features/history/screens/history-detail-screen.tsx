import { useLocalSearchParams } from 'expo-router';

import { EmptyState, Screen, ScreenHeader } from '@/components';

/** Single history entry. Loads from the history repository on the persistence day. */
export function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <ScreenHeader title="Translation" subtitle={id} />
      <EmptyState
        icon="document-text-outline"
        title="Entry unavailable"
        description="Saved translations become readable here once local storage is enabled."
      />
    </Screen>
  );
}
