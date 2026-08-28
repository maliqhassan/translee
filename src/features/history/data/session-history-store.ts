import { DEFAULTS, FEATURES, hasBackendConfigured } from '@/constants';
import type { HistoryEntry, TranslationResult } from '@/types';

import { SAMPLE_TRANSLATIONS } from './sample-translations';

/**
 * Translations made during this app session, newest first.
 *
 * In memory only, and deliberately so: persistence is the storage day's job.
 * This is the seam that day replaces — the repository will implement the same
 * read/record shape, and `useRecentTranslations` will not change.
 *
 * When there is no backend the sample rows seed the list, so development
 * against the sample engine still shows a populated Recent section.
 */

/** Keeps the session list bounded; the real store will page instead. */
const MAX_ENTRIES = 50;

const usingSampleEngine = FEATURES.mockTranslation || !hasBackendConfigured();

let entries: readonly HistoryEntry[] = usingSampleEngine ? SAMPLE_TRANSLATIONS : [];

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeToSessionHistory(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stable reference between changes, as `useSyncExternalStore` requires. */
export function getSessionHistory(): readonly HistoryEntry[] {
  return entries;
}

export function recordTranslation(result: TranslationResult): void {
  // A cache hit replays a result we already have; do not list it twice.
  if (entries.some((entry) => entry.id === result.id)) return;

  entries = [{ ...result, isFavorite: false }, ...entries].slice(0, MAX_ENTRIES);
  emit();
}

export function clearSessionHistory(): void {
  entries = [];
  emit();
}

/** How many entries the home screen shows. */
export const RECENT_LIMIT = DEFAULTS.recentOnHome;
