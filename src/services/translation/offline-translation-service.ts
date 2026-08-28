import type { LanguageId, TranslationRequest, TranslationResult } from '@/types';
import { appError, err } from '@/utils';

import type { ServiceResult } from '../types';

import type { OfflineTranslationEngine } from './offline/offline-engine';
import { unavailableOfflineEngine } from './offline/unavailable-engine';
import { normalizeTranslationRequest } from './translation-request';
import type { DetectedLanguage, TranslationService } from './translation-service';

/**
 * On-device engine, expressed as the `TranslationService` the router knows.
 *
 * This adapter is all the router ever sees. Which runtime is underneath, how
 * models are stored and how inference happens are the engine's business, so a
 * new runtime is a new `OfflineTranslationEngine` and one line in the registry.
 */
export function createOfflineTranslationService(
  engine: OfflineTranslationEngine,
): TranslationService {
  return {
    id: 'translation.offline',
    engine: 'offline',

    async isAvailable() {
      const available = await engine.isAvailable();
      // An engine that cannot answer is treated as absent: better to route
      // elsewhere than to hand a request to something in an unknown state.
      return available.ok && available.value;
    },

    async supportsPair(source: LanguageId, target: LanguageId) {
      const pairs = await engine.getReadyPairs();
      if (!pairs.ok) return false;
      return pairs.value.some((pair) => pair.source === source && pair.target === target);
    },

    async translate(request: TranslationRequest): ServiceResult<TranslationResult> {
      const normalized = normalizeTranslationRequest(request);
      if (!normalized.ok) return normalized;

      return engine.translate({ ...request, text: normalized.value.text });
    },

    detectLanguage(): ServiceResult<DetectedLanguage> {
      // The selected runtime exposes language identification as a separate
      // model. It is wired up on the day that model is added, not faked here.
      return Promise.resolve(
        err(appError('not_implemented', 'On-device language detection is not available yet.')),
      );
    },
  };
}

/**
 * The offline engine as it ships today: present in the architecture, honest
 * about having no runtime behind it. Replaced in the registry on Day 9.
 */
export const offlineTranslationService: TranslationService =
  createOfflineTranslationService(unavailableOfflineEngine);
