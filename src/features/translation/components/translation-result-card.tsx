import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Badge, Button, Card, Icon, IconButton, Skeleton, Spinner, Text } from '@/components';
import { errorMessage, getLanguage } from '@/constants';
import { useTheme } from '@/hooks';
import type { AsyncState, LanguageCode, TranslationEngine, TranslationResult } from '@/types';

import type { CopyController } from '../hooks/use-copy-to-clipboard';

export type TranslationResultCardProps = {
  state: AsyncState<TranslationResult>;
  targetLanguage: LanguageCode;
  copy: CopyController;
  onClear: () => void;
  onRetry: () => void;
};

const ENGINE_BADGE: Record<
  TranslationEngine,
  {
    label: string;
    tone: 'primary' | 'accent' | 'warning';
    icon: 'cloud-outline' | 'cloud-offline-outline' | 'flask-outline';
  }
> = {
  online: { label: 'Online', tone: 'primary', icon: 'cloud-outline' },
  offline: { label: 'Offline', tone: 'accent', icon: 'cloud-offline-outline' },
  mock: { label: 'Sample', tone: 'warning', icon: 'flask-outline' },
};

/** Shared shell so every state is the same size and the layout never jumps. */
function ResultShell({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Card variant="filled" style={{ minHeight: 160, gap: theme.spacing.md }}>
      {children}
    </Card>
  );
}

function TargetLabel({ code }: { code: LanguageCode }) {
  const language = getLanguage(code);
  return (
    <Text variant="caption" color="textMuted">
      {(language?.name ?? code).toUpperCase()}
    </Text>
  );
}

/** Renders whichever of idle / loading / error / success the screen is in. */
export function TranslationResultCard({
  state,
  targetLanguage,
  copy,
  onClear,
  onRetry,
}: TranslationResultCardProps) {
  const theme = useTheme();

  if (state.status === 'loading') {
    return (
      <ResultShell>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Spinner />
          <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
            Translating…
          </Text>
        </View>
        <View
          style={{ gap: theme.spacing.sm }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Skeleton height={18} width="92%" />
          <Skeleton height={18} width="78%" />
          <Skeleton height={18} width="55%" />
        </View>
      </ResultShell>
    );
  }

  if (state.status === 'error') {
    return (
      <ResultShell>
        <Animated.View
          entering={FadeIn.duration(theme.motion.duration.normal)}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md }}
        >
          <Icon name="cloud-offline-outline" size={26} color="textMuted" />
          <Text
            variant="bodySmall"
            color="textSecondary"
            align="center"
            accessibilityLiveRegion="polite"
          >
            {errorMessage(state.error)}
          </Text>
          <Button label="Try again" variant="secondary" size="sm" onPress={onRetry} />
        </Animated.View>
      </ResultShell>
    );
  }

  if (state.status === 'idle') {
    return (
      <ResultShell>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }}
        >
          <Icon name="language-outline" size={24} color="textMuted" />
          <Text variant="bodySmall" color="textMuted" align="center">
            Your translation will appear here.
          </Text>
        </View>
      </ResultShell>
    );
  }

  const result = state.data;
  const badge = ENGINE_BADGE[result.engine];

  return (
    <Animated.View entering={FadeInDown.duration(theme.motion.duration.normal).springify()}>
      <ResultShell>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <TargetLabel code={targetLanguage} />
          <Badge label={badge.label} tone={badge.tone} icon={badge.icon} />
        </View>

        <Text variant="translatedText" selectable accessibilityLiveRegion="polite">
          {result.translatedText}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: theme.spacing.xs,
          }}
        >
          <IconButton
            name="volume-medium-outline"
            accessibilityLabel="Read the translation aloud"
            disabled
          />
          <IconButton
            name={copy.justCopied ? 'checkmark-circle' : 'copy-outline'}
            accessibilityLabel={copy.justCopied ? 'Translation copied' : 'Copy the translation'}
            onPress={() => copy.copy(result.translatedText)}
          />
          <IconButton
            name="refresh-outline"
            accessibilityLabel="Clear the translation"
            onPress={onClear}
          />
        </View>
      </ResultShell>
    </Animated.View>
  );
}
