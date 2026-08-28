import { useCallback } from 'react';

import { DEFAULTS } from '@/constants';
import { DEFAULT_HISTORY_LIMIT } from '@/database';
import { services } from '@/services';
import type { AppError, HistoryEntry, TranslationResult } from '@/types';
import type { Result } from '@/utils';

import { useHistoryQuery, type HistoryQueryState } from './use-history-query';

/**
 * Feature-level access to persistent history.
 *
 * Screens use these hooks; none of them knows the repository is backed by
 * SQLite, and none of them issues a query from a render.
 */

/** The newest translations, for the home screen's Recent section. */
export function useRecentTranslations(
  limit: number = DEFAULTS.recentOnHome,
): HistoryQueryState<HistoryEntry[]> {
  return useHistoryQuery(
    useCallback(() => services.history.listRecent({ limit }), [limit]),
    [limit],
  );
}

/** The full history list, optionally filtered by a search term. */
export function useHistoryList(
  search: string,
  limit: number = DEFAULT_HISTORY_LIMIT,
): HistoryQueryState<HistoryEntry[]> & { reload: () => void } {
  const term = search.trim();

  return useHistoryQuery(
    useCallback(
      () =>
        term.length > 0
          ? services.history.search(term, { limit })
          : services.history.listRecent({ limit }),
      [term, limit],
    ),
    [term, limit],
  );
}

/** One entry by id. `null` data means the row is genuinely gone, not an error. */
export function useHistoryEntry(id: string): HistoryQueryState<HistoryEntry | null> {
  return useHistoryQuery(
    useCallback(() => services.history.getById(id), [id]),
    [id],
  );
}

export function useFavoriteTranslations(
  limit: number = DEFAULT_HISTORY_LIMIT,
): HistoryQueryState<HistoryEntry[]> {
  return useHistoryQuery(
    useCallback(() => services.history.listFavorites({ limit }), [limit]),
    [limit],
  );
}

export type HistoryActions = {
  toggleFavorite: (id: string) => Promise<Result<HistoryEntry | null, AppError>>;
  remove: (id: string) => Promise<Result<void, AppError>>;
  clear: () => Promise<Result<void, AppError>>;
};

/**
 * Mutations. The repository notifies its listeners, so every screen showing
 * history refreshes itself — no manual invalidation at the call site.
 */
export function useHistoryActions(): HistoryActions {
  return {
    toggleFavorite: useCallback((id: string) => services.history.toggleFavorite(id), []),
    remove: useCallback((id: string) => services.history.remove(id), []),
    clear: useCallback(() => services.history.clear(), []),
  };
}

/**
 * Records a completed translation.
 *
 * Called once per translate action, including when the result came from the
 * cache: the cache answers "what can we reuse", history answers "what did the
 * user do", and those are different questions.
 */
export function recordTranslation(
  result: TranslationResult,
): Promise<Result<HistoryEntry, AppError>> {
  return services.history.create(result);
}
