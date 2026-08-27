import { IconButton, ListItem } from '@/components';
import { getLanguage } from '@/constants';
import type { HistoryEntry } from '@/types';
import { formatRelativeTime, truncate } from '@/utils';

export type HistoryListItemProps = {
  entry: HistoryEntry;
  onPress?: (entry: HistoryEntry) => void;
  onToggleFavorite?: (entry: HistoryEntry) => void;
};

const ORIGIN_ICONS = {
  text: 'create-outline',
  camera: 'camera-outline',
  voice: 'mic-outline',
  clipboard: 'clipboard-outline',
} as const;

/** One saved translation. Pure presentation — persistence lives in the repository. */
export function HistoryListItem({ entry, onPress, onToggleFavorite }: HistoryListItemProps) {
  const target = getLanguage(entry.targetLanguage)?.name ?? entry.targetLanguage;

  return (
    <ListItem
      icon={ORIGIN_ICONS[entry.origin]}
      title={truncate(entry.translatedText, 60)}
      subtitle={`${target} · ${formatRelativeTime(entry.createdAt)}`}
      onPress={onPress ? () => onPress(entry) : undefined}
      showChevron={false}
      trailing={
        <IconButton
          name={entry.isFavorite ? 'star' : 'star-outline'}
          accessibilityLabel={entry.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          onPress={onToggleFavorite ? () => onToggleFavorite(entry) : undefined}
        />
      }
    />
  );
}
