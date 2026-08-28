import type { Preferences, TranslationMode } from '@/types';

import { DEFAULT_PREFERENCES } from './preferences-schema';

/**
 * The current preferences, readable from outside React.
 *
 * The translation router is a plain singleton built at import time, so it
 * cannot use a hook — but it does need to know the user's translation mode on
 * every request. This is the one-way bridge: the preferences store publishes
 * here whenever the user changes something, and the router reads it.
 *
 * Deliberately a snapshot of primitives and nothing more. It is not a second
 * source of truth: the store owns the state, this only mirrors it.
 */
let snapshot: Preferences = { ...DEFAULT_PREFERENCES };

export function publishActivePreferences(preferences: Preferences): void {
  snapshot = preferences;
}

export function getActivePreferences(): Preferences {
  return snapshot;
}

export function getActiveTranslationMode(): TranslationMode {
  return snapshot.translationMode;
}

/** Whether completed translations should be written to history. */
export function shouldSaveHistory(): boolean {
  return snapshot.saveHistory;
}

/** Test seam: restores the defaults between cases. */
export function resetActivePreferences(): void {
  snapshot = { ...DEFAULT_PREFERENCES };
}
