import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Icon } from '@/components';
import { useTheme } from '@/hooks';

/**
 * The swap control, sitting between the two language panels.
 *
 * Placed there deliberately: it reverses the direction of the pair, and
 * putting it on the line between them says that better than a button off to
 * one side. The arrows point up and down for the same reason — the panels are
 * stacked, not side by side.
 */

export type SwapLanguagesButtonProps = {
  canSwap: boolean;
  onSwap: () => void;
};

export function SwapLanguagesButton({ canSwap, onSwap }: SwapLanguagesButtonProps) {
  const theme = useTheme();
  const rotation = useSharedValue(0);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handlePress = () => {
    // Half a turn per press, so repeated swaps keep spinning the same way.
    rotation.value = withSpring(rotation.value + 180, { damping: 14, stiffness: 160 });
    onSwap();
  };

  return (
    <View style={{ alignItems: 'center', marginVertical: -theme.spacing.xs }}>
      <Pressable
        onPress={handlePress}
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
          borderWidth: 3,
          // Reads as a link between the two cards rather than a floating dot.
          borderColor: theme.colors.background,
          opacity: !canSwap
            ? theme.motion.opacityDisabled
            : pressed
              ? theme.motion.opacityPressed
              : 1,
        })}
      >
        <Animated.View style={iconStyle}>
          <Icon name="swap-vertical" size={20} color="primary" />
        </Animated.View>
      </Pressable>
    </View>
  );
}
