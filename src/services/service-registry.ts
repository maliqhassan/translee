import { FEATURES, TRANSLATION_CONFIG, hasBackendConfigured } from '@/constants';
import { createExpoSQLiteDatabase, createHistoryRepository } from '@/database';
import { TranseeMlKit } from '@modules/transee-mlkit';

import { expoClipboardService } from './clipboard';
import { createFetchHttpClient } from './http';
import { expoNetworkService } from './network';
import { ocrService } from './ocr';
import {
  createFilePreferencesStorage,
  createPreferencesService,
  getActiveTranslationMode,
} from './preferences';
import { expoTTSService, speechService } from './speech';
import {
  createBackendTranslationProvider,
  createInFlightRegistry,
  createMemoryTranslationCache,
  createNullTranslationCache,
  createMlKitOfflineEngine,
  createOfflineTranslationService,
  createOnlineTranslationService,
  createTranslationRouter,
  mockTranslationService,
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
 * Candidate engines.
 *
 * Configuration decides, not a hand-flipped switch: with no backend URL there
 * is nothing to call, so the sample engine serves development exactly as it
 * did before. Set `EXPO_PUBLIC_TRANSEE_API_URL` and the real online engine
 * takes over, with offline as the second candidate once it exists.
 * `FEATURES.mockTranslation` forces the sample engine either way.
 */
/**
 * The on-device engine.
 *
 * `TranseeMlKit` is null unless the native module was compiled into this build,
 * so a JS-only bundle or Expo Go gets an engine that reports itself unavailable
 * rather than one that throws. Nothing else in the app changes either way.
 */
const offlineRuntime = createMlKitOfflineEngine({ native: TranseeMlKit });

const offlineEngine = createOfflineTranslationService(offlineRuntime);

const useSampleEngine = FEATURES.mockTranslation || !hasBackendConfigured();

const translationEngines: readonly TranslationService[] = useSampleEngine
  ? [mockTranslationService]
  : [onlineTranslationService, offlineEngine];

const translationCache = TRANSLATION_CONFIG.cache.enabled
  ? createMemoryTranslationCache({ maxEntries: TRANSLATION_CONFIG.cache.maxEntries })
  : createNullTranslationCache();

const translationRouter = withCache(
  createTranslationRouter({
    engines: translationEngines,
    network: expoNetworkService,
    // Read per request, so changing the setting takes effect immediately.
    mode: getActiveTranslationMode,
  }),
  { cache: translationCache, inFlight: createInFlightRegistry() },
);

/**
 * Local persistence. The database driver is bound here like any other
 * implementation, so features depend on `HistoryRepository` and never on
 * expo-sqlite.
 */
const historyRepository = createHistoryRepository(createExpoSQLiteDatabase());

export const services = {
  translation: {
    /** What the UI calls. It never picks an engine itself. */
    router: translationRouter,
    online: onlineTranslationService,
    offline: offlineEngine,
    /** Exposed so settings can offer a "clear cached translations" action. */
    cache: translationCache,
  },
  /** Persistent translation history. Call `initialize()` before querying. */
  history: historyRepository,
  /** Device-local user settings. */
  preferences: createPreferencesService(createFilePreferencesStorage()),
  network: expoNetworkService,
  clipboard: expoClipboardService,
  ocr: ocrService,
  speech: speechService,
  tts: expoTTSService,
  /**
   * The on-device model runtime, for the language packs screen.
   *
   * This is the engine rather than the `TranslationService` wrapper, because
   * managing models is not translating: the screen needs `listModels`,
   * `downloadModel` and `deleteModel`, none of which the router's view
   * exposes. It stays behind `OfflineTranslationEngine`, so the screen still
   * knows nothing about ML Kit.
   */
  offlineModels: offlineRuntime,
} as const;

export type Services = typeof services;
