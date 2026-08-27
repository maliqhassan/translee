import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Card, Icon, Text } from '@/components';
import { getLanguage, isAutoDetect, languageShortCode } from '@/constants';
import { useResponsive, useTheme } from '@/hooks';
import type { LanguageField } from '@/store';
import type { LanguageId } from '@/types';

export type LanguageBarProps = {
  source: LanguageId;
  target: LanguageId;
  canSwap: boolean;
  onSelect: (field: LanguageField) => void;
  onSwap: () => void;
};

type ChipProps = {
  field: LanguageField;
  id: LanguageId;
  onPress: () => void;
};

const FIELD_LABEL: Record<LanguageField, string> = { source: 'From', target: 'To' };

function LanguageChip({ field, id, onPress }: ChipProps) {
  const theme = useTheme();
  const { isNarrow } = useResponsive();

  // All display metadata comes from the catalogue; nothing is hardcoded here.
  const language = getLanguage(id);
  const name = language?.name ?? id;
  const isTarget = field === 'target';
  const shortCode = isAutoDetect(id) ? undefined : languageShortCode(id);
  const nativeName =
    language && language.nativeName !== language.name ? language.nativeName : undefined;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${FIELD_LABEL[field]}: ${name}`}
      accessibilityHint={`Choose a different ${field} language`}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: isTarget ? 'flex-end' : 'flex-start',
        gap: theme.spacing.xxs,
        minHeight: theme.layout.minTouchTarget,
        justifyContent: 'center',
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        <Text variant="caption" color="textMuted">
          {FIELD_LABEL[field].toUpperCase()}
        </Text>
        {shortCode ? (
          <Text variant="caption" color={isTarget ? 'primary' : 'textMuted'}>
            {shortCode}
          </Text>
        ) : null}
      </View>

      <Text
        variant="bodyLarge"
        color={isTarget ? 'primary' : 'text'}
        numberOfLines={1}
        maxFontSizeMultiplier={1.5}
      >
        {name}
      </Text>

      {/* The endonym is the useful second line, but only where it fits. */}
      {nativeName && !isNarrow ? (
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {nativeName}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Source ⇄ target selector shared by the text, camera and voice flows. It owns
 * no language state — the pair comes from the language store via the screen.
 */
export function LanguageBar({ source, target, canSwap, onSelect, onSwap }: LanguageBarProps) {
  const theme = useTheme();
  const rotation = useSharedValue(0);

  const swapIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleSwap = () => {
    // Half a turn per press, so repeated swaps keep spinning the same way.
    rotation.value = withSpring(rotation.value + 180, { damping: 14, stiffness: 160 });
    onSwap();
  };

  return (
    <Card variant="elevated" padding="xs" elevation="sm">
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <LanguageChip field="source" id={source} onPress={() => onSelect('source')} />

        <Pressable
          onPress={handleSwap}
          disabled={!canSwap}
          hitSlop={theme.layout.iconHitSlop}
          accessibilityRole="button"
          accessibilityLabel="Swap languages"
          accessibilityState={{ disabled: !canSwap }}
          style={({ pressed }) => ({
            width: theme.layout.minTouchTarget,
            height: theme.layout.minTouchTarget,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.primaryMuted,
            opacity: !canSwap
              ? theme.motion.opacityDisabled
              : pressed
                ? theme.motion.opacityPressed
                : 1,
          })}
        >
          <Animated.View style={swapIconStyle}>
            <Icon name="swap-horizontal" size={20} color="primary" />
          </Animated.View>
        </Pressable>

        <LanguageChip field="target" id={target} onPress={() => onSelect('target')} />
      </View>
    </Card>
  );
}
