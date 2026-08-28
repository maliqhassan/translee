import { View } from 'react-native';

import { IconButton, ListItem } from '@/components';
import { languageName } from '@/constants';
import { useTheme } from '@/hooks';
import type { HistoryEntry } from '@/types';
import { formatRelativeTime, truncate } from '@/utils';

export type HistoryListItemProps = {
  entry: HistoryEntry;
  onPress?: (entry: HistoryEntry) => void;
  onToggleFavorite?: (entry: HistoryEntry) => void;
  onDelete?: (entry: HistoryEntry) => void;
};

const ORIGIN_ICONS = {
  text: 'create-outline',
  camera: 'camera-outline',
  voice: 'mic-outline',
  clipboard: 'clipboard-outline',
} as const;

/** One saved translation. Pure presentation — persistence lives in the repository. */
export function HistoryListItem({
  entry,
  onPress,
  onToggleFavorite,
  onDelete,
}: HistoryListItemProps) {
  const theme = useTheme();
  const source = languageName(entry.sourceLanguage);
  const target = languageName(entry.targetLanguage);

  return (
    <ListItem
      icon={ORIGIN_ICONS[entry.origin]}
      title={truncate(entry.translatedText, 60)}
      subtitle={`${source} → ${target} · ${formatRelativeTime(entry.createdAt)}`}
      onPress={onPress ? () => onPress(entry) : undefined}
      showChevron={false}
      accessibilityLabel={`${source} to ${target}. ${entry.sourceText}. Translated: ${entry.translatedText}. ${entry.isFavorite ? 'Favourite.' : ''}`}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs }}>
          <IconButton
            name={entry.isFavorite ? 'star' : 'star-outline'}
            accessibilityLabel={
              entry.isFavorite
                ? `Remove ${target} translation from favourites`
                : `Add ${target} translation to favourites`
            }
            onPress={onToggleFavorite ? () => onToggleFavorite(entry) : undefined}
          />
          {onDelete ? (
            <IconButton
              name="trash-outline"
              accessibilityLabel={`Delete ${target} translation`}
              onPress={() => onDelete(entry)}
            />
          ) : null}
        </View>
      }
    />
  );
}
