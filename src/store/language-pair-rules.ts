import { AUTO_DETECT_ID } from '@/constants';
import type { LanguageId, LanguagePair } from '@/types';

/**
 * Pure transition rules for the language pair, kept out of the provider so the
 * behaviour can be reasoned about — and tested — without React.
 */

/** How many recent picks are kept per side. */
export const RECENT_LIMIT = 6;

/** Newest first, de-duplicated, capped. The detect sentinel is never recorded. */
export function remember(list: readonly LanguageId[], id: LanguageId): readonly LanguageId[] {
  if (id === AUTO_DETECT_ID) return list;
  return [id, ...list.filter((existing) => existing !== id)].slice(0, RECENT_LIMIT);
}

/**
 * Choosing the language already on the other side swaps the pair instead of
 * producing a same-to-same translation. That keeps every pair meaningful
 * without ever refusing a tap.
 */
export function applySource(pair: LanguagePair, id: LanguageId): LanguagePair {
  return id === pair.target ? { source: id, target: pair.source } : { ...pair, source: id };
}

export function applyTarget(pair: LanguagePair, id: LanguageId): LanguagePair {
  return id === pair.source ? { source: pair.target, target: id } : { ...pair, target: id };
}

/** `auto` can never become a target, so swapping is a no-op in that case. */
export function applySwap(pair: LanguagePair): LanguagePair {
  if (pair.source === AUTO_DETECT_ID) return pair;
  return { source: pair.target, target: pair.source };
}

export function canSwap(pair: LanguagePair): boolean {
  return pair.source !== AUTO_DETECT_ID;
}
