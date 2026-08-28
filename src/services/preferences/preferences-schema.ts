import { DEFAULTS, getLanguage, isAutoDetect } from '@/constants';
import type { Preferences, ThemePreference, TranslationMode } from '@/types';

/**
 * The stored shape of preferences, and the rules for reading it back safely.
 *
 * Stored data is treated as untrusted input. A file can be truncated, written
 * by an older or newer build, or edited on a rooted device — so every field is
 * validated independently and anything unusable falls back to its default.
 * A bad value costs that one setting, never the launch.
 */

/**
 * Bumped when the stored shape changes in a way older readers cannot handle.
 *
 * Migration is per-field rather than per-version: unknown fields are ignored
 * and missing ones default, which means adding a preference needs no
 * migration at all. The version exists for the rarer case of a field changing
 * *meaning*, where `migrate` below is the place to translate it.
 */
export const PREFERENCES_VERSION = 1;

export const DEFAULT_PREFERENCES: Preferences = {
  sourceLanguage: DEFAULTS.sourceLanguage,
  targetLanguage: DEFAULTS.targetLanguage,
  translationMode: 'auto',
  theme: 'system',
  saveHistory: true,
};

const TRANSLATION_MODES: readonly TranslationMode[] = ['auto', 'online', 'offline'];
const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

/** A language is only accepted if the catalogue still knows it. */
function readLanguage(value: unknown, fallback: string): string {
  return typeof value === 'string' && getLanguage(value) ? value : fallback;
}

/**
 * A pair with the same language on both sides cannot translate anything, and
 * the language rules never produce one. Repair rather than store nonsense —
 * and make sure the repair itself does not collide.
 */
function repairTarget(source: string, target: string): string {
  if (target !== source) return target;
  return DEFAULT_PREFERENCES.targetLanguage === source
    ? DEFAULT_PREFERENCES.sourceLanguage
    : DEFAULT_PREFERENCES.targetLanguage;
}

/**
 * Hook for shape changes between versions. Nothing needs translating yet, so
 * this is the identity; it exists so the first real migration has an obvious
 * home rather than being bolted onto the parser.
 */
function migrate(record: Record<string, unknown>, version: number): Record<string, unknown> {
  if (version >= PREFERENCES_VERSION) return record;
  // Older payloads are read field by field below, which is already tolerant of
  // anything missing, so no rewriting is required for version 1.
  return record;
}

/**
 * Parses stored preferences, always returning a usable object.
 *
 * Never fails: unreadable input yields the defaults, and a partially valid
 * object keeps the fields that made sense.
 */
export function parsePreferences(payload: unknown): Preferences {
  if (!isRecord(payload)) return { ...DEFAULT_PREFERENCES };

  const version = typeof payload.version === 'number' ? payload.version : 0;
  const record = migrate(payload, version);

  const source = readLanguage(record.sourceLanguage, DEFAULT_PREFERENCES.sourceLanguage);
  const stored = readLanguage(record.targetLanguage, DEFAULT_PREFERENCES.targetLanguage);
  // `auto` means "detect the source" and is never a valid target.
  const target = isAutoDetect(stored) ? DEFAULT_PREFERENCES.targetLanguage : stored;

  return {
    sourceLanguage: source,
    targetLanguage: repairTarget(source, target),
    translationMode: readEnum(
      record.translationMode,
      TRANSLATION_MODES,
      DEFAULT_PREFERENCES.translationMode,
    ),
    theme: readEnum(record.theme, THEMES, DEFAULT_PREFERENCES.theme),
    saveHistory: readBoolean(record.saveHistory, DEFAULT_PREFERENCES.saveHistory),
  };
}

/** Only primitives are written — no state, services or runtime objects. */
export function serializePreferences(preferences: Preferences): string {
  return JSON.stringify({ version: PREFERENCES_VERSION, ...preferences });
}
