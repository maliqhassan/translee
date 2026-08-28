import { FEATURES, TRANSLATION_CONFIG } from '@/constants';

import { expoClipboardService } from './clipboard';
import { createFetchHttpClient } from './http';
import { languagePackManager } from './language-packs';
import { expoNetworkService } from './network';
import { ocrService } from './ocr';
import { speechService, ttsService } from './speech';
import {
  createBackendTranslationProvider,
  createInFlightRegistry,
  createMemoryTranslationCache,
  createNullTranslationCache,
  createOnlineTranslationService,
  createTranslationRouter,
  mockTranslationService,
  offlineTranslationService,
  unconfiguredOnlineTranslationService,
  withCache,
  type TranslationService,
} from './translation';

/**
 * Single place where concrete services are bound to their interfaces.
 *
 * Features import `services` (never a concrete module), which keeps screens
 * decoupled from engines and makes swapping a real implementation for a
 * placeholder — or a test double — a one-line change.
 */

const http = createFetchHttpClient({ defaultTimeoutMs: TRANSLATION_CONFIG.timeoutMs });

const backendProvider = createBackendTranslationProvider({
  baseUrl: TRANSLATION_CONFIG.backend.baseUrl,
  translatePath: TRANSLATION_CONFIG.backend.translatePath,
  http,
});

/**
 * The online engine is only built when a backend URL exists. Without one it
 * stays an inert stand-in, so a build with no backend can never fire a request
 * at a URL that is not there.
 */
const onlineTranslationService: TranslationService = backendProvider.isConfigured()
  ? createOnlineTranslationService({
      provider: backendProvider,
      network: expoNetworkService,
      retry: TRANSLATION_CONFIG.retry,
    })
  : unconfiguredOnlineTranslationService;

/**
 * Candidate engines. While `FEATURES.mockTranslation` is on, the sample engine
 * is the only candidate — that is what keeps development working without a
 * backend. Turning the flag off hands routing to the real online and offline
 * engines, ordered per request by connectivity.
 */
const translationEngines: readonly TranslationService[] = FEATURES.mockTranslation
  ? [mockTranslationService]
  : [onlineTranslationService, offlineTranslationService];

const translationCache = TRANSLATION_CONFIG.cache.enabled
  ? createMemoryTranslationCache({ maxEntries: TRANSLATION_CONFIG.cache.maxEntries })
  : createNullTranslationCache();

const translationRouter = withCache(
  createTranslationRouter({ engines: translationEngines, network: expoNetworkService }),
  { cache: translationCache, inFlight: createInFlightRegistry() },
);

export const services = {
  translation: {
    /** What the UI calls. It never picks an engine itself. */
    router: translationRouter,
    online: onlineTranslationService,
    offline: offlineTranslationService,
    /** Exposed so settings can offer a "clear cached translations" action. */
    cache: translationCache,
  },
  network: expoNetworkService,
  clipboard: expoClipboardService,
  ocr: ocrService,
  speech: speechService,
  tts: ttsService,
  languagePacks: languagePackManager,
} as const;

export type Services = typeof services;
