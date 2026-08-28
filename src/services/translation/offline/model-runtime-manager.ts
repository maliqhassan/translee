import type { AppError } from '@/types';
import { ok, type Result } from '@/utils';

import type { ServiceResult } from '../../types';

/**
 * Keeps loaded models loaded.
 *
 * Loading a translation model is the expensive part; translating with one
 * already in memory is not. So a model is loaded on first use and left there,
 * and concurrent requests for the same model share one load rather than
 * starting several.
 *
 * There is deliberately **no eviction policy**. Guessing at a memory budget
 * without measuring on real hardware would be inventing a number; `unload`
 * exists so a future policy — or the packs screen — can drive it explicitly
 * once there is evidence about what device memory actually demands.
 */
export type ModelRuntimeManager = {
  /** Loads if needed, then resolves. Safe to call repeatedly and concurrently. */
  ensureLoaded(modelId: string): ServiceResult<void>;
  unload(modelId: string): ServiceResult<void>;
  unloadAll(): ServiceResult<void>;
  isLoaded(modelId: string): boolean;
  /** Model ids currently in memory. */
  loaded(): readonly string[];
};

export type RuntimeLoader = {
  load(modelId: string): ServiceResult<void>;
  unload(modelId: string): ServiceResult<void>;
};

export function createModelRuntimeManager(loader: RuntimeLoader): ModelRuntimeManager {
  const loaded = new Set<string>();
  /** In-flight loads, so two translations never load the same model twice. */
  const loading = new Map<string, Promise<Result<void, AppError>>>();

  return {
    ensureLoaded(modelId: string): ServiceResult<void> {
      if (loaded.has(modelId)) return Promise.resolve(ok(undefined));

      const inFlight = loading.get(modelId);
      if (inFlight) return inFlight;

      const started = loader
        .load(modelId)
        .then((result) => {
          // Only a successful load counts as loaded; a failure leaves the
          // model unloaded so the next attempt genuinely retries.
          if (result.ok) loaded.add(modelId);
          return result;
        })
        .finally(() => {
          loading.delete(modelId);
        });

      loading.set(modelId, started);
      return started;
    },

    async unload(modelId: string) {
      if (!loaded.has(modelId)) return ok(undefined);

      const result = await loader.unload(modelId);
      if (result.ok) loaded.delete(modelId);
      return result;
    },

    async unloadAll() {
      for (const modelId of [...loaded]) {
        const result = await loader.unload(modelId);
        if (!result.ok) return result;
        loaded.delete(modelId);
      }
      return ok(undefined);
    },

    isLoaded: (modelId: string) => loaded.has(modelId),
    loaded: () => [...loaded],
  };
}
