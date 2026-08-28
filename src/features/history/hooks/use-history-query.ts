import { useCallback, useEffect, useState } from 'react';

import { services } from '@/services';
import { useDatabaseState } from '@/store';
import type { AppError, AsyncState } from '@/types';
import type { Result } from '@/utils';

/**
 * Runs a history query and keeps it fresh.
 *
 * Every history screen needs the same three things: wait for the database,
 * re-run when the data changes, and never call SQLite from a render. This is
 * that, once, so the screens stay declarative.
 *
 * Re-running is driven by the repository's own change notifications rather
 * than polling, so a create, delete or favourite refreshes exactly the screens
 * that are listening.
 */

/**
 * A history query is never idle: it is loading from the first render, so the
 * idle case is excluded rather than left for every screen to handle.
 */
export type HistoryQueryState<T> = Exclude<AsyncState<T>, { status: 'idle' }>;

const LOADING = { status: 'loading' } as const;

export function useHistoryQuery<T>(
  query: () => Promise<Result<T, AppError>>,
  /** Re-runs when any of these change, alongside repository notifications. */
  dependencies: readonly unknown[] = [],
): HistoryQueryState<T> & { reload: () => void } {
  const database = useDatabaseState();
  const [nonce, setNonce] = useState(0);

  /**
   * Results are tagged with the query they answered. Anything else is stale,
   * which is what lets "loading" be derived during render rather than pushed
   * from inside an effect.
   */
  const key = `${nonce}:${dependencies.map((value) => String(value)).join('|')}`;
  const [answer, setAnswer] = useState<{ key: string; state: HistoryQueryState<T> } | null>(null);

  const reload = useCallback(() => setNonce((current) => current + 1), []);

  useEffect(() => {
    if (database.status !== 'ready') return;

    let active = true;
    void query().then((result) => {
      if (!active) return;
      setAnswer({
        key,
        state: result.ok
          ? { status: 'success', data: result.value }
          : { status: 'error', error: result.error },
      });
    });

    return () => {
      active = false;
    };
    // `query` is rebuilt on every render by callers, so `key` is what decides
    // when a re-run is actually wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [database.status, key]);

  useEffect(() => services.history.subscribe(reload), [reload]);

  // Derived, never synced: the database's own failure is the more useful
  // message, and a result for a different query is not this query's answer.
  const state: HistoryQueryState<T> =
    database.status === 'error'
      ? {
          status: 'error',
          error: database.error ?? { code: 'storage_error', message: 'History is unavailable.' },
        }
      : database.status !== 'ready' || answer?.key !== key
        ? LOADING
        : answer.state;

  return { ...state, reload };
}
