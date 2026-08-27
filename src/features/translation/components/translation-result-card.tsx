import { View } from 'react-native';

import { Badge, Card, IconButton, LoadingState, Text } from '@/components';
import { useTheme } from '@/hooks';
import type { AsyncStatus, TranslationResult } from '@/types';

export type TranslationResultCardProps = {
  status: AsyncStatus;
  result?: TranslationResult;
  /** Copy / speak / favourite actions are enabled once the result exists. */
  onCopy?: () => void;
  onSpeak?: () => void;
};

/** Renders whichever of idle / loading / result the translate screen is in. */
export function TranslationResultCard({
  status,
  result,
  onCopy,
  onSpeak,
}: TranslationResultCardProps) {
  const theme = useTheme();

  if (status === 'loading') {
    return (
      <Card variant="filled" style={{ minHeight: 140 }}>
        <LoadingState message="Translating…" />
      </Card>
    );
  }

  if (!result) {
    return (
      <Card variant="filled" style={{ minHeight: 140, justifyContent: 'center' }}>
        <Text variant="body" color="textMuted" align="center">
          Your translation will appear here.
        </Text>
      </Card>
    );
  }

  return (
    <Card variant="filled" style={{ gap: theme.spacing.md, minHeight: 140 }}>
      <Text variant="translatedText">{result.translatedText}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Badge
          label={result.engine === 'offline' ? 'Offline' : 'Online'}
          tone={result.engine === 'offline' ? 'accent' : 'primary'}
          icon={result.engine === 'offline' ? 'cloud-offline-outline' : 'cloud-outline'}
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
          <IconButton
            name="volume-medium-outline"
            accessibilityLabel="Read aloud"
            onPress={onSpeak}
          />
          <IconButton name="copy-outline" accessibilityLabel="Copy translation" onPress={onCopy} />
        </View>
      </View>
    </Card>
  );
}
