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
  /**
   * Whether an on-device result may still be handed back.
   *
   * The cache sits above the router, so a hit never reaches the routing policy
   * and would otherwise keep serving an on-device translation long after the
   * plan that earned it lapsed. Omitted means permitted.
   */
  offlineEntitled?: () => boolean;
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

  /**
   * Whether a stored result is still the user's to receive.
   *
   * Only on-device results can go stale this way, and only by entitlement —
   * so nothing else is re-examined, and a refused entry is left in place
   * rather than evicted. Someone who resubscribes gets their cache back, and
   * the online entries sitting beside it were never in question.
   */
  const mayServe = (result: TranslationResult): boolean =>
    result.engine !== 'offline' || (options.offlineEntitled?.() ?? true);

  return {
    async translate(request: TranslationRequest): ServiceResult<TranslationResult> {
      const normalized = normalizeTranslationRequest(request);
      // Invalid requests are the router's to reject, with its wording.
      if (!normalized.ok) return router.translate(request);

      const cached = await cache.get(normalized.value);
      if (cached && mayServe(cached)) {
        log.debug('cache hit');
        return ok(cached);
      }

      const key = translationCacheKey(normalized.value);
      const run = async (): ServiceResult<TranslationResult> => {
        const result = await router.translate(request);
        if (result.ok) await cache.set(normalized.value, result.value);
        return result;
      };

      /*
       * Known and accepted: a request that joins one already in flight
       * receives its result directly, without passing `mayServe`. So a second
       * request for identical text, made in the moment between an on-device
       * translation starting and settling, can still be served across a
       * simultaneous loss of entitlement.
       *
       * Left alone deliberately. Closing it means either refusing to share
       * in-flight work or re-translating the joiner's request, and neither is
       * worth it for a window this narrow: the entitlement would have to lapse
       * during a single translation, and the next request is gated normally.
       */
      return inFlight ? inFlight.run(key, run) : run();
    },

    resolveEngine: (request) => router.resolveEngine(request),
  };
}
