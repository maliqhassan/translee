import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks';

export type ScreenProps = {
  children: ReactNode;
  /** Pinned above the scroll area, so a title stays put while content moves. */
  header?: ReactNode;
  /** Wraps content in a ScrollView. Off by default so lists can own scrolling. */
  scrollable?: boolean;
  /** Lifts content above the keyboard. Enable on screens with a text input. */
  keyboardAvoiding?: boolean;
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
  header,
  scrollable = false,
  keyboardAvoiding = false,
  edgeToEdge = false,
  edges = ['top'],
  contentStyle,
}: ScreenProps) {
  const theme = useTheme();

  const padding: ViewStyle = {
    paddingHorizontal: edgeToEdge ? 0 : theme.layout.screenPadding,
  };

  const body = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
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
  );

  const content = (
    <>
      {header ? <View style={padding}>{header}</View> : null}
      {body}
    </>
  );

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          // Android resizes the window itself; adding padding on top double-counts.
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
