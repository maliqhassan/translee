import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList } from 'react-native';

import {
  Divider,
  EmptyState,
  Icon,
  IconButton,
  Input,
  ListItem,
  Screen,
  ScreenHeader,
  Text,
} from '@/components';
import { LANGUAGES, TARGET_LANGUAGES } from '@/constants';
import { useTheme } from '@/hooks';
import { useLanguagePair } from '@/store';
import type { Language, LanguageCode } from '@/types';

import type { LanguageField } from '../components/language-bar';

/**
 * Full-screen language chooser pushed from the translate, camera and voice
 * flows. It writes straight to the language store, so callers only navigate.
 *
 * The list is the static reference set from `constants/languages`; the fuller
 * catalogue (with per-pair offline availability) replaces `LANGUAGES` later.
 */
export function LanguagePickerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { field } = useLocalSearchParams<{ field?: LanguageField }>();
  const { pair, setSource, setTarget } = useLanguagePair();

  const isSource = field !== 'target';
  const selected = isSource ? pair.source : pair.target;
  const [query, setQuery] = useState('');

  const results = useMemo<readonly Language[]>(() => {
    const pool = isSource ? LANGUAGES : TARGET_LANGUAGES;
    const needle = query.trim().toLowerCase();
    if (!needle) return pool;
    return pool.filter(
      (language) =>
        language.name.toLowerCase().includes(needle) ||
        language.nativeName.toLowerCase().includes(needle) ||
        language.code.toLowerCase() === needle,
    );
  }, [isSource, query]);

  const choose = (code: LanguageCode) => {
    if (isSource) setSource(code);
    else setTarget(code);
    router.back();
  };

  return (
    <Screen
      header={
        <ScreenHeader
          compact
          title={isSource ? 'Translate from' : 'Translate to'}
          actions={
            <IconButton
              name="close"
              variant="soft"
              accessibilityLabel="Close"
              onPress={() => router.back()}
            />
          }
        />
      }
    >
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search languages"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Search languages"
        containerStyle={{ marginBottom: theme.spacing.base }}
      />

      <FlatList
        data={results}
        keyExtractor={(item) => item.code}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ItemSeparatorComponent={() => <Divider inset={theme.spacing.base} />}
        contentContainerStyle={
          results.length === 0 ? { flexGrow: 1 } : { paddingBottom: theme.spacing.xxxl }
        }
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="No languages found"
            description={`Nothing matches “${query.trim()}”.`}
          />
        }
        renderItem={({ item }) => {
          const isSelected = item.code === selected;
          return (
            <ListItem
              title={item.name}
              subtitle={item.nativeName === item.name ? undefined : item.nativeName}
              onPress={() => choose(item.code)}
              showChevron={false}
              trailing={
                isSelected ? (
                  <Icon name="checkmark-circle" color="primary" />
                ) : item.code === 'auto' ? undefined : (
                  <Text variant="caption" color="textMuted">
                    {item.code.toUpperCase()}
                  </Text>
                )
              }
            />
          );
        }}
      />
    </Screen>
  );
}
