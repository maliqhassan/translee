import { err, notImplemented } from '@/utils';

import type { ServiceResult } from '../types';

import type { DetectedLanguage, TranslationService } from './translation-service';

/**
 * Network-backed engine. Placeholder only — the HTTP client, provider choice,
 * retry policy and quota handling all land on the online-translation day.
 */
export const onlineTranslationService: TranslationService = {
  id: 'translation.online',
  engine: 'online',

  async isAvailable() {
    return false;
  },

  async supportsPair() {
    return false;
  },

  translate(): ServiceResult<never> {
    return Promise.resolve(err(notImplemented('Online translation')));
  },

  detectLanguage(): ServiceResult<DetectedLanguage> {
    return Promise.resolve(err(notImplemented('Online language detection')));
  },
};
