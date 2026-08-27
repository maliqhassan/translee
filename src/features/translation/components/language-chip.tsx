import { memo, useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components';
import { useTheme } from '@/hooks';
import type { Language, LanguageId } from '@/types';

export type LanguageChipProps = {
  language: Language;
  isSelected: boolean;
  onSelect: (id: LanguageId) => void;
};

/** Compact tappable pill used by the Popular and Recent shortlists. */
function LanguageChipComponent({ language, isSelected, onSelect }: LanguageChipProps) {
  const theme = useTheme();
  const handlePress = useCallback(() => onSelect(language.id), [onSelect, language.id]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={language.name}
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        minHeight: 38,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.full,
        borderWidth: theme.layout.borderWidth,
        borderColor: isSelected ? theme.colors.primaryBorder : theme.colors.border,
        backgroundColor: isSelected
          ? theme.colors.primaryMuted
          : pressed
            ? theme.colors.surfaceMuted
            : theme.colors.surface,
      })}
    >
      {isSelected ? <Icon name="checkmark" size={13} color="primary" /> : null}
      <Text variant="bodySmall" color={isSelected ? 'primary' : 'text'} numberOfLines={1}>
        {language.name}
      </Text>
    </Pressable>
  );
}

export const LanguageChip = memo(LanguageChipComponent);

export type LanguageChipRowProps = {
  languages: readonly Language[];
  selectedId: LanguageId;
  onSelect: (id: LanguageId) => void;
};

/** Wrapping cloud of chips. Short lists only — the full catalogue is a list. */
export function LanguageChipRow({ languages, selectedId, onSelect }: LanguageChipRowProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.base,
        paddingBottom: theme.spacing.base,
      }}
    >
      {languages.map((language) => (
        <LanguageChip
          key={language.id}
          language={language}
          isSelected={language.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}
