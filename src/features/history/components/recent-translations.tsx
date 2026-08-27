import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { View } from 'react-native';

import { Button, Card, Divider, EmptyState, SectionHeader } from '@/components';
import { useTheme } from '@/hooks';
import type { HistoryEntry } from '@/types';

import { useRecentTranslations } from '../hooks/use-recent-translations';

import { RecentTranslationRow } from './recent-translation-row';

/**
 * Recent translations, surfaced on the home screen. Owns its own data source
 * so the translate screen stays a composition of sections.
 */
export function RecentTranslations() {
  const theme = useTheme();
  const router = useRouter();
  const entries = useRecentTranslations();

  const open = (entry: HistoryEntry) => {
    router.push({ pathname: '/history/[id]', params: { id: entry.id } });
  };

  return (
    <View>
      <SectionHeader
        title="Recent"
        action={
          entries.length > 0 ? (
            <Button
              label="See all"
              variant="ghost"
              size="sm"
              icon="chevron-forward"
              iconPosition="right"
              onPress={() => router.push('/history')}
              style={{ paddingHorizontal: theme.spacing.xs }}
            />
          ) : undefined
        }
      />

      <Card variant="outlined" padding="none">
        {entries.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="Nothing yet"
            description="Translations you make will show up here."
            compact
          />
        ) : (
          entries.map((entry, index) => (
            <Fragment key={entry.id}>
              {index > 0 ? <Divider inset={theme.spacing.base} /> : null}
              <RecentTranslationRow entry={entry} onPress={open} />
            </Fragment>
          ))
        )}
      </Card>
    </View>
  );
}
