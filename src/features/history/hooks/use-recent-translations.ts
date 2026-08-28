import { useMemo, useSyncExternalStore } from 'react';

import { DEFAULTS } from '@/constants';
import type { HistoryEntry } from '@/types';

import { getSessionHistory, subscribeToSessionHistory } from '../data/session-history-store';

/**
 * The most recent translations, newest first.
 *
 * Backed by the in-memory session store today. On the persistence day this
 * reads the history repository instead; the return type is already what
 * callers expect, so no component changes.
 */
export function useRecentTranslations(
  limit: number = DEFAULTS.recentOnHome,
): readonly HistoryEntry[] {
  const entries = useSyncExternalStore(subscribeToSessionHistory, getSessionHistory);

  return useMemo(
    () => [...entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit),
    [entries, limit],
  );
}
