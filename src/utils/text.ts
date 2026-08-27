/**
 * Lowercases and strips combining accents so a search for "espanol" matches
 * "Español" and "francais" matches "Français".
 *
 * `normalize` is guarded because it depends on the JS engine's Unicode data;
 * without it the fold still lowercases, which is the common case.
 */

/** U+0300 to U+036F, the combining diacritical marks block. */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036F]', 'g');

export function foldForSearch(text: string): string {
  const lowered = text.trim().toLowerCase();
  if (typeof lowered.normalize !== 'function') return lowered;
  return lowered.normalize('NFD').replace(COMBINING_MARKS, '');
}
