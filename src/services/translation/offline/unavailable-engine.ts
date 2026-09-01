import { appError, err, ok } from '@/utils';

import type { OfflineTranslationEngine } from './offline-engine';

/**
 * The engine that ships today: none.
 *
 * No machine-translation runtime is installed in the app yet — that needs a
 * native module and a development build, neither of which exists in the
 * project as of Day 8 (see `docs/OFFLINE_TRANSLATION.md`). Rather than stub
 * something that looks like it works, this reports the truth at every method,
 * so the router produces an honest `model_missing` and the UI can say so.
 *
 * Day 9 replaces this one object in the registry. Nothing else changes.
 */
export const unavailableOfflineEngine: OfflineTranslationEngine = {
  id: 'offline.unavailable',

  async isAvailable() {
    return ok(false);
  },

  async getSupportedLanguages() {
    // Empty, not a guess. Reporting languages here would mark them
    // offline-capable when nothing can translate them.
    return ok([]);
  },

  async getReadyPairs() {
    return ok([]);
  },

  async listModels() {
    return ok([]);
  },

  async downloadModel() {
    return err(
      appError('model_missing', 'No on-device translation runtime is installed in this build.'),
    );
  },

  async deleteModel() {
    return err(
      appError('model_missing', 'No on-device translation runtime is installed in this build.'),
    );
  },

  async loadModel() {
    return err(
      appError('model_missing', 'No on-device translation runtime is installed in this build.'),
    );
  },

  async unloadModel() {
    // Nothing is loaded, so unloading is trivially satisfied.
    return ok(undefined);
  },

  async translate() {
    return err(
      appError('model_missing', 'On-device translation is not available in this build yet.'),
    );
  },
};
