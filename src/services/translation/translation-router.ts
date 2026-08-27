import type { TranslationEngine, TranslationRequest, TranslationResult } from '@/types';
import { appError, createLogger, err } from '@/utils';

import type { ServiceResult } from '../types';

import type { TranslationRouter, TranslationService } from './translation-service';

const log = createLogger('translation.router');

/**
 * Picks the first engine that is available and can handle the requested pair,
 * in the order it was given. That order is the routing policy: the registry
 * decides it, so adding connectivity or an offline-first preference later is a
 * change to the candidate list rather than to any caller.
 */
export function createTranslationRouter(engines: readonly TranslationService[]): TranslationRouter {
  async function pick(request: TranslationRequest): Promise<TranslationService | undefined> {
    for (const engine of engines) {
      const [available, supportsPair] = await Promise.all([
        engine.isAvailable(),
        engine.supportsPair(request.sourceLanguage, request.targetLanguage),
      ]);
      if (available && supportsPair) return engine;
    }
    return undefined;
  }

  return {
    async translate(request: TranslationRequest): ServiceResult<TranslationResult> {
      const engine = await pick(request);

      if (!engine) {
        log.warn('no engine for request', {
          source: request.sourceLanguage,
          target: request.targetLanguage,
        });
        return err(
          appError(
            'unsupported_language',
            `No engine handles ${request.sourceLanguage} to ${request.targetLanguage}.`,
          ),
        );
      }

      return engine.translate(request);
    },

    async resolveEngine(request: TranslationRequest): Promise<TranslationEngine> {
      const engine = await pick(request);
      // Nothing can serve the request; report the engine the UI would have used.
      return engine?.engine ?? 'online';
    },
  };
}
