import type { LanguageId, TranslationRequest, TranslationResult } from '@/types';
import { appError, createId, createLogger, err, ok } from '@/utils';

import { runWithRetry, type RetryPolicy } from '../http';
import type { NetworkService } from '../network';
import type { ServiceResult } from '../types';

import type { TranslationProvider } from './provider';
import { normalizeTranslationRequest } from './translation-request';
import type { DetectedLanguage, TranslationService } from './translation-service';

const log = createLogger('translation.online');

export type OnlineTranslationOptions = {
  provider: TranslationProvider;
  network: NetworkService;
  retry: RetryPolicy;
  /** Injectable so tests do not sleep between attempts. */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Network-backed engine.
 *
 * It owns validation, retry and the mapping from a provider payload to a
 * `TranslationResult`. It does not choose a provider or decide whether online
 * is the right engine — the registry picks the provider, the router picks the
 * engine.
 */
export function createOnlineTranslationService(
  options: OnlineTranslationOptions,
): TranslationService {
  const { provider, network, retry } = options;

  return {
    id: 'translation.online',
    engine: 'online',

    async isAvailable() {
      if (!provider.isConfigured()) return false;
      // `unknown` counts as available: the request itself is a better probe
      // than a connectivity guess, and it fails fast if there is no route.
      return (await network.getStatus()) !== 'offline';
    },

    async supportsPair(source: LanguageId, target: LanguageId) {
      return provider.supportsPair(source, target);
    },

    async translate(request: TranslationRequest): ServiceResult<TranslationResult> {
      const normalized = normalizeTranslationRequest(request);
      if (!normalized.ok) return normalized;

      const attempt = await runWithRetry(
        (n) => {
          if (n > 1) log.warn(`retrying translation, attempt ${n}`);
          return provider.translate(normalized.value);
        },
        { policy: retry, sleep: options.sleep },
      );

      if (!attempt.ok) return attempt;

      const { translatedText, detectedLanguage } = attempt.value;

      return ok({
        id: createId('tr'),
        sourceText: normalized.value.text,
        translatedText,
        sourceLanguage: normalized.value.sourceLanguage,
        detectedLanguage,
        targetLanguage: normalized.value.targetLanguage,
        engine: 'online',
        origin: normalized.value.origin,
        createdAt: Date.now(),
      });
    },

    detectLanguage(): ServiceResult<DetectedLanguage> {
      // The backend exposes detection through `translate` with `auto`; a
      // standalone endpoint is added when a screen actually needs one.
      return Promise.resolve(
        err(appError('not_implemented', 'Standalone language detection has no endpoint yet.')),
      );
    },
  };
}

/**
 * Unconfigured stand-in, kept so the registry always has an online entry.
 * Replaced by `createOnlineTranslationService` once a backend URL exists.
 */
export const unconfiguredOnlineTranslationService: TranslationService = {
  id: 'translation.online.unconfigured',
  engine: 'online',
  async isAvailable() {
    return false;
  },
  async supportsPair() {
    return false;
  },
  translate: () =>
    Promise.resolve(err(appError('service_unavailable', 'No translation backend is configured.'))),
  detectLanguage: () =>
    Promise.resolve(err(appError('service_unavailable', 'No translation backend is configured.'))),
};
