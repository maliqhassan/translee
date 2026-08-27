import { FEATURES } from '@/constants';

import { expoClipboardService } from './clipboard';
import { languagePackManager } from './language-packs';
import { ocrService } from './ocr';
import { speechService, ttsService } from './speech';
import {
  createTranslationRouter,
  mockTranslationService,
  offlineTranslationService,
  onlineTranslationService,
  type TranslationService,
} from './translation';

/**
 * Routing policy, expressed as an ordered candidate list. While
 * `FEATURES.mockTranslation` is on, the sample engine is the only candidate;
 * turning the flag off restores the real online-then-offline order.
 */
const translationEngines: readonly TranslationService[] = FEATURES.mockTranslation
  ? [mockTranslationService]
  : [onlineTranslationService, offlineTranslationService];

/**
 * Single place where concrete services are bound to their interfaces.
 *
 * Features import `services` (never a concrete module), which keeps screens
 * decoupled from engines and makes swapping a real implementation for a
 * placeholder — or a test double — a one-line change.
 */
export const services = {
  translation: {
    /** What the UI calls. It never picks an engine itself. */
    router: createTranslationRouter(translationEngines),
    online: onlineTranslationService,
    offline: offlineTranslationService,
  },
  clipboard: expoClipboardService,
  ocr: ocrService,
  speech: speechService,
  tts: ttsService,
  languagePacks: languagePackManager,
} as const;

export type Services = typeof services;
