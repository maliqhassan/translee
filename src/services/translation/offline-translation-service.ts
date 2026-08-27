import { err, notImplemented } from '@/utils';

import type { ServiceResult } from '../types';

import type { DetectedLanguage, TranslationService } from './translation-service';

/**
 * On-device engine backed by downloaded language packs. Placeholder only — the
 * model runtime and pack lookup arrive on the offline-translation day.
 */
export const offlineTranslationService: TranslationService = {
  id: 'translation.offline',
  engine: 'offline',

  async isAvailable() {
    return false;
  },

  async supportsPair() {
    return false;
  },

  translate(): ServiceResult<never> {
    return Promise.resolve(err(notImplemented('Offline translation')));
  },

  detectLanguage(): ServiceResult<DetectedLanguage> {
    return Promise.resolve(err(notImplemented('Offline language detection')));
  },
};
