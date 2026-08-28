import type { ServiceResult } from '../types';

/**
 * A single named slot of text.
 *
 * Preferences are a handful of primitives, so the storage need is one small
 * blob — not a database. Keeping the seam this narrow means the platform API
 * behind it can change without anything above noticing, and tests can supply
 * an in-memory slot or a deliberately failing one.
 */
export type PreferencesStorage = {
  /** Resolves to null when nothing has been written yet. */
  read(): ServiceResult<string | null>;
  write(contents: string): ServiceResult<void>;
  remove(): ServiceResult<void>;
};
