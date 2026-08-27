import { View } from 'react-native';

import { Badge, IconButton, ListItem, Text } from '@/components';
import { getLanguage } from '@/constants';
import { useTheme } from '@/hooks';
import type { LanguagePack, LanguagePackStatus } from '@/services';
import { formatBytes } from '@/utils';

export type LanguagePackItemProps = {
  pack: LanguagePack;
  onDownload?: (pack: LanguagePack) => void;
  onRemove?: (pack: LanguagePack) => void;
};

const STATUS_TONE = {
  not_installed: 'neutral',
  queued: 'neutral',
  downloading: 'primary',
  installed: 'success',
  update_available: 'warning',
  failed: 'danger',
} as const satisfies Record<LanguagePackStatus, string>;

const STATUS_LABEL = {
  not_installed: 'Not installed',
  queued: 'Queued',
  downloading: 'Downloading',
  installed: 'Installed',
  update_available: 'Update available',
  failed: 'Failed',
} as const satisfies Record<LanguagePackStatus, string>;

/** One downloadable offline model. Download progress is bound in on the packs day. */
export function LanguagePackItem({ pack, onDownload, onRemove }: LanguagePackItemProps) {
  const theme = useTheme();
  const source = getLanguage(pack.source)?.name ?? pack.source;
  const target = getLanguage(pack.target)?.name ?? pack.target;
  const installed = pack.status === 'installed';

  return (
    <ListItem
      icon="download-outline"
      title={`${source} → ${target}`}
      subtitle={formatBytes(pack.sizeBytes)}
      showChevron={false}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Badge label={STATUS_LABEL[pack.status]} tone={STATUS_TONE[pack.status]} />
          <IconButton
            name={installed ? 'trash-outline' : 'cloud-download-outline'}
            accessibilityLabel={
              installed ? `Remove ${source} to ${target}` : `Download ${source} to ${target}`
            }
            onPress={() => (installed ? onRemove?.(pack) : onDownload?.(pack))}
          />
        </View>
      }
    />
  );
}

export type LanguagePackStorageSummaryProps = { usedBytes: number };

export function LanguagePackStorageSummary({ usedBytes }: LanguagePackStorageSummaryProps) {
  return (
    <Text variant="bodySmall" color="textSecondary">
      {formatBytes(usedBytes)} used by installed packs
    </Text>
  );
}
