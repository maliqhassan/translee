import { useMemo } from 'react';

import { DEFAULTS } from '@/constants';
import type { HistoryEntry } from '@/types';

import { SAMPLE_TRANSLATIONS } from '../data/sample-translations';

/**
 * The most recent translations, newest first.
 *
 * Backed by sample data today. On the persistence day this reads the history
 * repository instead; the return type is already what callers expect, so no
 * component changes.
 */
export function useRecentTranslations(
  limit: number = DEFAULTS.recentOnHome,
): readonly HistoryEntry[] {
  return useMemo(
    () => [...SAMPLE_TRANSLATIONS].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit),
    [limit],
  );
}
