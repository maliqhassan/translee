import type { ReactNode } from 'react';
import { ScrollView, StatusBar, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks';

export type ScreenProps = {
  children: ReactNode;
  /** Wraps content in a ScrollView. Off by default so lists can own scrolling. */
  scrollable?: boolean;
  /** Removes the default horizontal gutter for edge-to-edge content. */
  edgeToEdge?: boolean;
  edges?: readonly Edge[];
  contentStyle?: ViewStyle;
};

/**
 * Every route renders inside a Screen so safe areas, background colour and
 * gutters are decided once instead of per screen.
 */
export function Screen({
  children,
  scrollable = false,
  edgeToEdge = false,
  edges = ['top'],
  contentStyle,
}: ScreenProps) {
  const theme = useTheme();

  const padding: ViewStyle = {
    paddingHorizontal: edgeToEdge ? 0 : theme.layout.screenPadding,
  };

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {scrollable ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            padding,
            { paddingBottom: theme.spacing.xxxl, gap: theme.spacing.base },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
