import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components';
import { getLanguage, isAutoDetect, languageShortCode } from '@/constants';
import { useTheme } from '@/hooks';
import type { LanguageField } from '@/store';
import type { LanguageId } from '@/types';

/**
 * The language line at the top of a translation panel.
 *
 * Each panel now carries its own language rather than both being named in a
 * separate bar above them, so it is obvious at a glance which text is which.
 * Tapping the name opens the picker for that side, which is also how the
 * language gets changed — one affordance instead of two.
 *
 * Presentational: every piece of display metadata comes from the catalogue.
 */

export type LanguagePanelHeaderProps = {
  field: LanguageField;
  id: LanguageId;
  onPress: () => void;
  /** Panel-specific controls, e.g. copy or listen. */
  actions?: ReactNode;
};

const FIELD_LABEL: Record<LanguageField, string> = { source: 'From', target: 'To' };

export function LanguagePanelHeader({ field, id, onPress, actions }: LanguagePanelHeaderProps) {
  const theme = useTheme();

  const language = getLanguage(id);
  const name = language?.name ?? id;
  const shortCode = isAutoDetect(id) ? undefined : languageShortCode(id);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
        minHeight: theme.layout.minTouchTarget,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${FIELD_LABEL[field]}: ${name}`}
        accessibilityHint={`Choose a different ${field} language`}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          marginLeft: -theme.spacing.sm,
          borderRadius: theme.radius.md,
          backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
        })}
      >
        {shortCode ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.xs,
              paddingVertical: theme.spacing.xxs,
              borderRadius: theme.radius.sm,
              backgroundColor:
                field === 'target' ? theme.colors.primaryMuted : theme.colors.surfaceMuted,
            }}
          >
            <Text variant="caption" color={field === 'target' ? 'primary' : 'textSecondary'}>
              {shortCode}
            </Text>
          </View>
        ) : null}

        <Text
          variant="body"
          color={field === 'target' ? 'primary' : 'text'}
          numberOfLines={1}
          maxFontSizeMultiplier={1.4}
          style={{ flexShrink: 1 }}
        >
          {name}
        </Text>

        <Icon name="chevron-down" size={14} color="textMuted" />
      </Pressable>

      {actions ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs }}>
          {actions}
        </View>
      ) : null}
    </View>
  );
}
