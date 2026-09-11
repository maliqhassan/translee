import { memo, useCallback } from 'react';
import { View } from 'react-native';

import { Badge, Icon, ListItem, Text } from '@/components';
import { languageShortCode } from '@/constants';
import { useTheme } from '@/hooks';
import type { LanguagePackState } from '@/services';
import type { Language, LanguageId } from '@/types';

export type LanguageRowProps = {
  language: Language;
  /** True when this is the language currently set for the side being picked. */
  isSelected: boolean;
  /**
   * Set when this language is currently on the *other* side of the pair.
   * Choosing it swaps the two, and the badge says so before the tap.
   */
  otherSideLabel?: 'Source' | 'Target';
  /**
   * What the on-device runtime has for this language, when it knows.
   *
   * Undefined means the runtime cannot serve it at all, or there is no runtime
   * in this build — which is not the same as "not downloaded", so no icon is
   * drawn rather than a misleading one.
   */
  packState?: LanguagePackState;
  onSelect: (id: LanguageId) => void;
};

/** A quiet indicator; it must never compete with the language name. */
const PACK_ICON = {
  ready: { name: 'checkmark-circle', color: 'success', label: 'downloaded for offline use' },
  not_downloaded: {
    name: 'cloud-download-outline',
    color: 'textMuted',
    label: 'available to download',
  },
  downloading: { name: 'arrow-down-circle-outline', color: 'primary', label: 'downloading' },
  removing: { name: 'trash-outline', color: 'warning', label: 'being removed' },
  failed: { name: 'alert-circle-outline', color: 'danger', label: 'download failed' },
} as const satisfies Record<LanguagePackState, { name: string; color: string; label: string }>;

/**
 * One row of the language list.
 *
 * Memoised, and it takes primitives plus a stable `onSelect`, so scrolling a
 * hundred-language catalogue does not re-render rows that have not changed.
 */
function LanguageRowComponent({
  language,
  isSelected,
  otherSideLabel,
  packState,
  onSelect,
}: LanguageRowProps) {
  const theme = useTheme();
  const handlePress = useCallback(() => onSelect(language.id), [onSelect, language.id]);

  const showNativeName = language.nativeName !== language.name;

  const pack = packState ? PACK_ICON[packState] : undefined;

  const label = [
    language.name,
    showNativeName ? language.nativeName : undefined,
    otherSideLabel ? `currently the ${otherSideLabel.toLowerCase()} language` : undefined,
    pack ? pack.label : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <ListItem
      title={language.name}
      subtitle={showNativeName ? language.nativeName : undefined}
      onPress={handlePress}
      showChevron={false}
      selected={isSelected}
      accessibilityLabel={label}
      accessibilityHint={
        otherSideLabel ? 'Selecting this swaps the two languages' : 'Selects this language'
      }
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {otherSideLabel ? <Badge label={otherSideLabel} tone="neutral" /> : null}

          <Text variant="caption" color="textMuted">
            {languageShortCode(language.id)}
          </Text>

          {/* Offline availability, straight from the runtime. */}
          {pack ? <Icon name={pack.name} size={17} color={pack.color} /> : null}

          {isSelected ? <Icon name="checkmark-circle" size={20} color="primary" /> : null}
        </View>
      }
    />
  );
}

export const LanguageRow = memo(LanguageRowComponent);
