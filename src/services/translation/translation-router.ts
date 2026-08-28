import type { TranslationEngine, TranslationRequest, TranslationResult } from '@/types';
import { appError, createLogger, err } from '@/utils';

import type { NetworkService, NetworkStatus } from '../network';
import type { ServiceResult } from '../types';

import { orderEngines } from './routing-policy';
import { normalizeTranslationRequest } from './translation-request';
import type { TranslationRouter, TranslationService } from './translation-service';

const log = createLogger('translation.router');

export type TranslationRouterOptions = {
  /** Candidates, in registry order. `orderEngines` re-ranks per request. */
  engines: readonly TranslationService[];
  /** Omitted in tests and dev builds; connectivity is then `unknown`. */
  network?: NetworkService;
  /** Settings preference, read lazily so a change takes effect immediately. */
  preferOffline?: () => boolean;
};

/**
 * Chooses which engine serves a request, and is the only place that decision
 * is made. Screens and hooks call `translate` and never see an engine.
 *
 * Validation happens here rather than in each engine, so a request that could
 * never succeed fails immediately instead of after a network round trip.
 */
export function createTranslationRouter(options: TranslationRouterOptions): TranslationRouter {
  const { engines, network } = options;

  async function status(): Promise<NetworkStatus> {
    return network ? network.getStatus() : 'unknown';
  }

  async function pick(
    request: TranslationRequest,
    networkStatus: NetworkStatus,
  ): Promise<TranslationService | undefined> {
    const ordered = orderEngines(engines, {
      network: networkStatus,
      preferOffline: options.preferOffline?.() ?? false,
    });

    for (const engine of ordered) {
      const [available, supportsPair] = await Promise.all([
        engine.isAvailable(),
        engine.supportsPair(request.sourceLanguage, request.targetLanguage),
      ]);
      if (available && supportsPair) return engine;
    }
    return undefined;
  }

  /** What to tell the user when nothing can serve the request. */
  function unavailable(request: TranslationRequest, networkStatus: NetworkStatus) {
    if (networkStatus === 'offline') {
      return appError(
        'network_unavailable',
        `Offline, and no on-device model covers ${request.sourceLanguage} to ${request.targetLanguage}.`,
      );
    }
    return appError(
      'unsupported_language',
      `No engine handles ${request.sourceLanguage} to ${request.targetLanguage}.`,
    );
  }

  return {
    async translate(request: TranslationRequest): ServiceResult<TranslationResult> {
      const normalized = normalizeTranslationRequest(request);
      if (!normalized.ok) return normalized;

      const networkStatus = await status();
      const engine = await pick(request, networkStatus);

      if (!engine) {
        log.warn('no engine for request', {
          source: request.sourceLanguage,
          target: request.targetLanguage,
          network: networkStatus,
        });
        return err(unavailable(request, networkStatus));
      }

      return engine.translate({ ...request, text: normalized.value.text });
    },

    async resolveEngine(request: TranslationRequest): Promise<TranslationEngine> {
      const engine = await pick(request, await status());
      // Nothing can serve the request; report the engine the UI would have used.
      return engine?.engine ?? 'online';
    },
  };
}
