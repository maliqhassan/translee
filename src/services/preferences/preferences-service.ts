import type { Preferences } from '@/types';
import { createLogger, ok } from '@/utils';

import type { Service, ServiceResult } from '../types';

import { DEFAULT_PREFERENCES, parsePreferences, serializePreferences } from './preferences-schema';
import type { PreferencesStorage } from './preferences-storage';

const log = createLogger('preferences');

/**
 * Reads and writes the user's preferences.
 *
 * `load` never fails: unreadable or corrupt storage yields the defaults, so a
 * settings problem can never stop the app launching. `save` does report
 * failure, because the user just asked for something and deserves to know if
 * it will not stick.
 */
export type PreferencesService = Service & {
  /** Always resolves to usable preferences, defaults included. */
  load(): Promise<Preferences>;
  save(preferences: Preferences): ServiceResult<void>;
  /** Restores the documented defaults and persists them. */
  reset(): ServiceResult<Preferences>;
};

export function createPreferencesService(storage: PreferencesStorage): PreferencesService {
  return {
    id: 'preferences',

    async isAvailable() {
      return true;
    },

    async load(): Promise<Preferences> {
      const stored = await storage.read();

      if (!stored.ok) {
        // Storage is unreadable. Run on defaults rather than refusing to start.
        log.warn('preferences unreadable; using defaults');
        return { ...DEFAULT_PREFERENCES };
      }

      if (stored.value === null) return { ...DEFAULT_PREFERENCES };

      try {
        return parsePreferences(JSON.parse(stored.value) as unknown);
      } catch {
        // Not valid JSON at all — truncated write, or a file we did not author.
        log.warn('preferences were not valid JSON; using defaults');
        return { ...DEFAULT_PREFERENCES };
      }
    },

    save(preferences: Preferences): ServiceResult<void> {
      return storage.write(serializePreferences(preferences));
    },

    async reset(): ServiceResult<Preferences> {
      const defaults = { ...DEFAULT_PREFERENCES };
      const written = await storage.write(serializePreferences(defaults));
      // Even if the write fails the runtime state should still return to
      // defaults; the caller decides whether to surface the failure.
      return written.ok ? ok(defaults) : written;
    },
  };
}
