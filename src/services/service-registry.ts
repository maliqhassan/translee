import { languagePackManager } from './language-packs';
import { ocrService } from './ocr';
import { speechService, ttsService } from './speech';
import { offlineTranslationService, onlineTranslationService } from './translation';

/**
 * Single place where concrete services are bound to their interfaces.
 *
 * Features import `services` (never a concrete module), which keeps screens
 * decoupled from engines and makes swapping a real implementation for a
 * placeholder — or a test double — a one-line change.
 */
export const services = {
  translation: {
    online: onlineTranslationService,
    offline: offlineTranslationService,
  },
  ocr: ocrService,
  speech: speechService,
  tts: ttsService,
  languagePacks: languagePackManager,
} as const;

export type Services = typeof services;
