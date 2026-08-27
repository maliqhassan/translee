import { View } from 'react-native';

import { Icon } from '@/components';
import { useTheme } from '@/hooks';

/** The small Transee glyph that anchors the home header. */
export function BrandMark() {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.primary,
      }}
    >
      <Icon name="language" size={19} color="textOnPrimary" />
    </View>
  );
}
