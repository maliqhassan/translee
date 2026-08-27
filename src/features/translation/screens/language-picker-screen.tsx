import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { Divider, EmptyState, Icon, Input, ListItem, Screen, ScreenHeader } from '@/components';
import { LANGUAGES, TARGET_LANGUAGES } from '@/constants';
import { useTheme } from '@/hooks';
import { useLanguagePair } from '@/store';
import type { Language } from '@/types';

import type { LanguageField } from '../components/language-bar';

/** Full-screen language chooser pushed from the translate, camera and voice flows. */
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
        language.nativeName.toLowerCase().includes(needle),
    );
  }, [isSource, query]);

  const choose = (code: string) => {
    if (isSource) setSource(code);
    else setTarget(code);
    router.back();
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={isSource ? 'Translate from' : 'Translate to'} />

      <View style={{ gap: theme.spacing.base, flex: 1 }}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search languages"
          autoCorrect={false}
          returnKeyType="search"
        />

        <FlatList
          data={results}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <Divider inset={theme.spacing.base} />}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No languages found"
              description={`Nothing matches “${query}”.`}
              compact
            />
          }
          renderItem={({ item }) => (
            <ListItem
              title={item.name}
              subtitle={item.nativeName === item.name ? undefined : item.nativeName}
              onPress={() => choose(item.code)}
              showChevron={false}
              trailing={
                item.code === selected ? <Icon name="checkmark" color="primary" /> : undefined
              }
            />
          )}
        />
      </View>
    </Screen>
  );
}
