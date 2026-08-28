import type { TranslationResult } from '@/types';

import { translationCacheKey, type NormalizedTranslationRequest } from './translation-request';

/**
 * Cache seam.
 *
 * Deliberately async even though today's implementation is synchronous: the
 * next implementations are SQLite and then an offline-first store, and an
 * async contract now means swapping them in later is a registry change rather
 * than a rewrite of every caller.
 */
export type TranslationCache = {
  get(request: NormalizedTranslationRequest): Promise<TranslationResult | undefined>;
  set(request: NormalizedTranslationRequest, result: TranslationResult): Promise<void>;
  clear(): Promise<void>;
};

export type MemoryCacheOptions = {
  /** Least-recently-used entries are dropped past this count. */
  maxEntries: number;
};

/**
 * In-memory LRU, backed by a Map.
 *
 * Map keeps insertion order, so re-inserting on every read makes the oldest
 * key the first one iteration yields — which is exactly the entry to evict.
 */
export function createMemoryTranslationCache(options: MemoryCacheOptions): TranslationCache {
  const entries = new Map<string, TranslationResult>();
  const limit = Math.max(1, options.maxEntries);

  return {
    async get(request) {
      const key = translationCacheKey(request);
      const hit = entries.get(key);
      if (hit === undefined) return undefined;

      // Touch, so this entry becomes the most recently used.
      entries.delete(key);
      entries.set(key, hit);
      return hit;
    },

    async set(request, result) {
      const key = translationCacheKey(request);
      entries.delete(key);
      entries.set(key, result);

      while (entries.size > limit) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
    },

    async clear() {
      entries.clear();
    },
  };
}

/** A cache that never stores anything, for builds that opt out. */
export function createNullTranslationCache(): TranslationCache {
  return {
    async get() {
      return undefined;
    },
    async set() {},
    async clear() {},
  };
}
