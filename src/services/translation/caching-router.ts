import type { TranslationRequest, TranslationResult } from '@/types';
import { createLogger, ok } from '@/utils';

import type { ServiceResult } from '../types';

import type { InFlightRegistry } from './in-flight-requests';
import type { TranslationCache } from './translation-cache';
import { normalizeTranslationRequest, translationCacheKey } from './translation-request';
import type { TranslationRouter } from './translation-service';

const log = createLogger('translation.cache');

export type CachingRouterOptions = {
  cache: TranslationCache;
  /** Collapses concurrent identical requests onto one call. */
  inFlight?: InFlightRegistry;
};

/**
 * Wraps a router with caching and de-duplication.
 *
 * Kept as a decorator rather than folded into the router so each concern stays
 * separately testable, and so the cache applies to whichever engine ran — an
 * offline result is worth reusing as much as an online one.
 *
 * Only successes are cached. A failure is usually about the moment (no signal,
 * a timeout, a server restart) and caching it would make a recovered service
 * look broken.
 */
export function withCache(
  router: TranslationRouter,
  options: CachingRouterOptions,
): TranslationRouter {
  const { cache, inFlight } = options;

  return {
    async translate(request: TranslationRequest): ServiceResult<TranslationResult> {
      const normalized = normalizeTranslationRequest(request);
      // Invalid requests are the router's to reject, with its wording.
      if (!normalized.ok) return router.translate(request);

      const cached = await cache.get(normalized.value);
      if (cached) {
        log.debug('cache hit');
        return ok(cached);
      }

      const key = translationCacheKey(normalized.value);
      const run = async (): ServiceResult<TranslationResult> => {
        const result = await router.translate(request);
        if (result.ok) await cache.set(normalized.value, result.value);
        return result;
      };

      return inFlight ? inFlight.run(key, run) : run();
    },

    resolveEngine: (request) => router.resolveEngine(request),
  };
}
