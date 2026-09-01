import { ActivityIndicator, View } from 'react-native';

import { Badge, IconButton, ListItem } from '@/components';
import type { BadgeTone } from '@/components';
import { useTheme } from '@/hooks';
import type { LanguagePack, LanguagePackState } from '@/services';

export type LanguagePackItemProps = {
  pack: LanguagePack;
  onDownload?: (pack: LanguagePack) => void;
  onRemove?: (pack: LanguagePack) => void;
};

const STATE_TONE = {
  not_downloaded: 'neutral',
  downloading: 'primary',
  ready: 'success',
  failed: 'danger',
} as const satisfies Record<LanguagePackState, BadgeTone>;

const STATE_LABEL = {
  not_downloaded: 'Not downloaded',
  downloading: 'Downloading',
  ready: 'Downloaded',
  failed: 'Failed',
} as const satisfies Record<LanguagePackState, string>;

/**
 * One language's on-device model.
 *
 * A pack is a language, not a pair — downloading English and German is what
 * makes both directions between them work. The subtitle is the endonym rather
 * than a download size: the runtime does not report sizes, so there is no
 * number here to show.
 */
export function LanguagePackItem({ pack, onDownload, onRemove }: LanguagePackItemProps) {
  const theme = useTheme();
  const busy = pack.state === 'downloading';
  const ready = pack.state === 'ready';

  return (
    <ListItem
      icon={ready ? 'checkmark-circle-outline' : 'cloud-download-outline'}
      title={pack.name}
      subtitle={pack.nativeName}
      showChevron={false}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Badge label={STATE_LABEL[pack.state]} tone={STATE_TONE[pack.state]} />
          {busy ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <IconButton
              name={ready ? 'trash-outline' : 'cloud-download-outline'}
              accessibilityLabel={
                ready ? `Remove the ${pack.name} pack` : `Download the ${pack.name} pack`
              }
              onPress={() => (ready ? onRemove?.(pack) : onDownload?.(pack))}
            />
          )}
        </View>
      }
    />
  );
}
