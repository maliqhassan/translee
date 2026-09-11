import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Platform, View, type ListRenderItemInfo } from 'react-native';

import {
  Divider,
  EmptyState,
  GradientHeader,
  IconButton,
  Screen,
  SearchField,
  SectionHeader,
  SegmentedControl,
} from '@/components';
import { useLanguagePackStatus } from '@/features/offline';
import { useTheme } from '@/hooks';
import type { LanguageField } from '@/store';

import { LanguageChipRow } from '../components/language-chip';
import { LanguageRow } from '../components/language-row';
import { useLanguagePicker, type PickerRow } from '../hooks/use-language-picker';

/**
 * Full-screen language chooser pushed from the translate, camera and voice
 * flows. It writes straight to the language store, so callers only navigate.
 *
 * Headers, shortlists and the catalogue are flattened into one FlatList so the
 * whole screen stays virtualised as the catalogue grows.
 */
export function LanguagePickerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { field } = useLocalSearchParams<{ field?: LanguageField }>();

  /**
   * The route says which side was tapped; the switch below lets the user
   * change their mind without going back and tapping the other one.
   */
  const [side, setSide] = useState<LanguageField>(field === 'target' ? 'target' : 'source');

  const dismiss = useCallback(() => router.back(), [router]);
  const picker = useLanguagePicker(side, dismiss);

  /** Real offline availability, from the same runtime the packs screen reads. */
  const packStatus = useLanguagePackStatus();

  const { selectedId, otherSideId, select } = picker;
  const otherSideLabel = side === 'source' ? 'Target' : 'Source';

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PickerRow>) => {
      if (item.kind === 'section') {
        return (
          <View style={{ paddingHorizontal: theme.spacing.base, paddingTop: theme.spacing.base }}>
            <SectionHeader title={item.title} />
          </View>
        );
      }

      if (item.kind === 'chips') {
        return (
          <LanguageChipRow languages={item.languages} selectedId={selectedId} onSelect={select} />
        );
      }

      return (
        <LanguageRow
          language={item.language}
          isSelected={item.language.id === selectedId}
          otherSideLabel={item.language.id === otherSideId ? otherSideLabel : undefined}
          packState={packStatus[item.language.id]}
          onSelect={select}
        />
      );
    },
    [otherSideId, otherSideLabel, packStatus, select, selectedId, theme.spacing.base],
  );

  return (
    <Screen
      edgeToEdge
      headerBleed
      edges={['bottom']}
      header={
        <GradientHeader
          title="Language Selection"
          actions={
            <IconButton
              name="close"
              variant="soft"
              accessibilityLabel="Close language picker"
              onPress={dismiss}
            />
          }
        >
          <SegmentedControl
            onGradient
            accessibilityLabel="Choose which side of the pair to change"
            options={[
              { value: 'source', label: 'FROM' },
              { value: 'target', label: 'TO' },
            ]}
            value={side}
            onChange={setSide}
          />

          <SearchField
            value={picker.query}
            onChangeText={picker.setQuery}
            onClear={picker.clearQuery}
            placeholder="Search by name or code"
            accessibilityLabel="Search languages by name, native name or code"
          />
        </GradientHeader>
      }
    >
      <FlatList
        data={picker.rows}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ItemSeparatorComponent={({ leadingItem }: { leadingItem?: PickerRow }) =>
          leadingItem?.kind === 'language' ? <Divider inset={theme.spacing.base} /> : null
        }
        contentContainerStyle={
          picker.rows.length === 0
            ? { flexGrow: 1 }
            : { paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xxxl }
        }
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="No languages found"
            description={`Nothing matches “${picker.query.trim()}”. Try a name, a native name or a code like DE.`}
          />
        }
        initialNumToRender={14}
        maxToRenderPerBatch={16}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </Screen>
  );
}
