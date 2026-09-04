import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { offlineReadiness, services, type OfflineReadiness } from '@/services';
import { useLanguagePair } from '@/store';

/**
 * Whether on-device translation could serve the current pair, and why not.
 *
 * Asked before the user presses Translate, so the screen can offer the fix
 * instead of a failure. Re-checked on focus rather than once on mount: the
 * usual way this changes is the user downloading a pack and coming back, and
 * a stale "not downloaded" notice after that would be worse than none.
 *
 * Reading the runtime is a query, never a download.
 */

export type OfflineReadinessState = {
  /** Undefined until the first read completes, so nothing flashes wrongly. */
  readiness?: OfflineReadiness;
  recheck: () => void;
};

export function useOfflineReadiness(enabled: boolean): OfflineReadinessState {
  const { pair } = useLanguagePair();
  const [readiness, setReadiness] = useState<OfflineReadiness | undefined>(undefined);

  const read = useCallback(async () => {
    const runtime = services.offlineModels;

    const [available, supported, models] = await Promise.all([
      runtime.isAvailable(),
      runtime.getSupportedLanguages(),
      runtime.listModels(),
    ]);

    return offlineReadiness({
      runtimeAvailable: available.ok && available.value,
      supported: supported.ok ? supported.value : [],
      // A model list we could not read means nothing is known to be present,
      // which is the safe answer: it points at downloading, never at trying.
      downloaded: models.ok
        ? models.value.filter((model) => model.status === 'ready').map((model) => model.language)
        : [],
      source: pair.source,
      target: pair.target,
    });
  }, [pair.source, pair.target]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setReadiness(undefined);
        return;
      }

      let cancelled = false;
      void read().then((next) => {
        if (!cancelled) setReadiness(next);
      });

      return () => {
        cancelled = true;
      };
    }, [enabled, read]),
  );

  return { readiness, recheck: () => void read().then(setReadiness) };
}
