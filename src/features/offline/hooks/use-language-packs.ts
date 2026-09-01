import { useCallback, useEffect, useState } from 'react';

import { services } from '@/services';
import { toLanguagePacks, type LanguagePack, type PackOverrides } from '@/services';
import type { AppError } from '@/types';

/**
 * Language packs, as the screen needs them.
 *
 * The runtime is the single source of truth for what is on the device, so this
 * always re-reads `listModels()` after a change rather than mutating a local
 * copy. What the runtime *cannot* know — that a download is in flight, or that
 * the last attempt failed — is held here and overlaid, which keeps the two
 * kinds of state from being confused for one another.
 *
 * Nothing here downloads on its own. `download` runs only when a user asks.
 */

export type LanguagePacksState = {
  /** Whether the runtime exists in this build at all. */
  available: boolean;
  loading: boolean;
  packs: readonly LanguagePack[];
  /** Set when the list itself could not be read. */
  error?: AppError;
  /** Set when the last download or removal failed, for a dismissible notice. */
  actionError?: AppError;
  download: (modelId: string) => void;
  remove: (modelId: string) => void;
  dismissActionError: () => void;
};

export function useLanguagePacks(): LanguagePacksState {
  const [packs, setPacks] = useState<readonly LanguagePack[]>([]);
  const [overrides, setOverrides] = useState<PackOverrides>({});
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | undefined>(undefined);
  const [actionError, setActionError] = useState<AppError | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      const runtime = services.offlineModels;
      const isAvailable = await runtime.isAvailable();
      const models = await runtime.listModels();
      if (cancelled) return;

      setAvailable(isAvailable.ok && isAvailable.value);
      if (models.ok) {
        setPacks(toLanguagePacks(models.value));
        setError(undefined);
      } else {
        setPacks([]);
        setError(models.error);
      }
      setLoading(false);
    };

    void read();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((current) => current + 1), []);

  /**
   * Both actions share a shape: mark in flight, call the runtime, then re-read.
   * The override is cleared on success so the runtime's own answer takes over,
   * and left as `failed` otherwise so the row can say so.
   */
  const run = useCallback(
    (modelId: string, action: (id: string) => Promise<{ ok: boolean; error?: AppError }>) => {
      setOverrides((current) => ({ ...current, [modelId]: 'downloading' }));
      setActionError(undefined);

      void (async () => {
        const result = await action(modelId);

        setOverrides((current) => {
          const next = { ...current };
          if (result.ok) delete next[modelId];
          else next[modelId] = 'failed';
          return next;
        });

        if (!result.ok && result.error) setActionError(result.error);
        reload();
      })();
    },
    [reload],
  );

  const download = useCallback(
    (modelId: string) => run(modelId, (id) => services.offlineModels.downloadModel(id)),
    [run],
  );

  const remove = useCallback(
    (modelId: string) => run(modelId, (id) => services.offlineModels.deleteModel(id)),
    [run],
  );

  return {
    available,
    loading,
    // Overlaid during render rather than written into state, so an in-flight
    // download can never be mistaken for something the device actually has.
    packs: applyOverrides(packs, overrides),
    error,
    actionError,
    download,
    remove,
    dismissActionError: useCallback(() => setActionError(undefined), []),
  };
}

function applyOverrides(
  packs: readonly LanguagePack[],
  overrides: PackOverrides,
): readonly LanguagePack[] {
  if (Object.keys(overrides).length === 0) return packs;
  return packs.map((pack) => {
    const override = overrides[pack.modelId];
    return override ? { ...pack, state: override } : pack;
  });
}
