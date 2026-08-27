import { memo, useCallback } from 'react';
import { View } from 'react-native';

import { Badge, Icon, ListItem, Text } from '@/components';
import { languageShortCode } from '@/constants';
import { useTheme } from '@/hooks';
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
  onSelect: (id: LanguageId) => void;
};

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
  onSelect,
}: LanguageRowProps) {
  const theme = useTheme();
  const handlePress = useCallback(() => onSelect(language.id), [onSelect, language.id]);

  const showNativeName = language.nativeName !== language.name;

  const label = [
    language.name,
    showNativeName ? language.nativeName : undefined,
    otherSideLabel ? `currently the ${otherSideLabel.toLowerCase()} language` : undefined,
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
          {isSelected ? (
            <Icon name="checkmark-circle" size={20} color="primary" />
          ) : (
            <Text variant="caption" color="textMuted">
              {languageShortCode(language.id)}
            </Text>
          )}
        </View>
      }
    />
  );
}

export const LanguageRow = memo(LanguageRowComponent);
