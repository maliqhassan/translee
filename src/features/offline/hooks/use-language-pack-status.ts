import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { FEATURES } from '@/constants';
import { services, toLanguagePacks, type LanguagePackState } from '@/services';
import type { LanguageId } from '@/types';

/**
 * What the device has, keyed by language, for lists that want to show it.
 *
 * Read-only and derived from the same runtime the packs screen uses — there is
 * no second source and nothing cached separately. A language absent from the
 * map is one the runtime cannot serve at all, which is different from one it
 * could serve but has not downloaded, and the picker renders the two
 * differently rather than collapsing them.
 *
 * Re-read on focus, so downloading a pack and coming back shows the change.
 * Reading the runtime is a query; it never downloads anything.
 */

export type LanguagePackStatusMap = Readonly<Partial<Record<LanguageId, LanguagePackState>>>;

export function useLanguagePackStatus(): LanguagePackStatusMap {
  const [status, setStatus] = useState<LanguagePackStatusMap>({});

  useFocusEffect(
    useCallback(() => {
      if (!FEATURES.offlineTranslation) return;

      let cancelled = false;

      void (async () => {
        const available = await services.offlineModels.isAvailable();
        if (!available.ok || !available.value) return;

        const models = await services.offlineModels.listModels();
        if (cancelled || !models.ok) return;

        const next: Record<string, LanguagePackState> = {};
        for (const pack of toLanguagePacks(models.value)) {
          next[pack.language] = pack.state;
        }
        setStatus(next);
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  return status;
}
