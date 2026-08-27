import { View } from 'react-native';

import { useTheme } from '@/hooks';

export type DividerProps = {
  /** Indent from the left, matching list item content. */
  inset?: number;
};

export function Divider({ inset = 0 }: DividerProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: theme.layout.hairline,
        marginLeft: inset,
        backgroundColor: theme.colors.border,
      }}
    />
  );
}
