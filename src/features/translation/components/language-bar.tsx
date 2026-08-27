import { Pressable, View } from 'react-native';

import { IconButton, Text } from '@/components';
import { getLanguage } from '@/constants';
import { useTheme } from '@/hooks';
import type { LanguageCode } from '@/types';

export type LanguageField = 'source' | 'target';

export type LanguageBarProps = {
  source: LanguageCode;
  target: LanguageCode;
  canSwap: boolean;
  onSelect: (field: LanguageField) => void;
  onSwap: () => void;
};

function LanguageChip({
  code,
  align,
  onPress,
}: {
  code: LanguageCode;
  align: 'flex-start' | 'flex-end';
  onPress: () => void;
}) {
  const theme = useTheme();
  const language = getLanguage(code);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Change language, currently ${language?.name ?? code}`}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: align,
        gap: theme.spacing.xxs,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
      })}
    >
      <Text variant="label" color="textMuted">
        {align === 'flex-start' ? 'FROM' : 'TO'}
      </Text>
      <Text variant="bodyLarge" numberOfLines={1}>
        {language?.name ?? code}
      </Text>
    </Pressable>
  );
}

/** Source ⇄ target selector shared by the text, camera and voice flows. */
export function LanguageBar({ source, target, canSwap, onSelect, onSwap }: LanguageBarProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        borderWidth: theme.layout.borderWidth,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.spacing.xs,
      }}
    >
      <LanguageChip code={source} align="flex-start" onPress={() => onSelect('source')} />
      <IconButton
        name="swap-horizontal"
        variant="soft"
        accessibilityLabel="Swap languages"
        disabled={!canSwap}
        onPress={onSwap}
      />
      <LanguageChip code={target} align="flex-end" onPress={() => onSelect('target')} />
    </View>
  );
}
