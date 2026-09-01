import { getLanguage } from '@/constants';
import type { LanguageId } from '@/types';

import type { OfflineModel, OfflineModelStatus } from '../translation/offline/offline-engine';

/**
 * What the language packs screen shows, derived from the model registry.
 *
 * A pack is **one language**, not a pair. The chosen runtime downloads one
 * model per language and needs both sides present to translate between them,
 * so `English + German` is two packs that between them enable `en -> de` and
 * `de -> en`. Storing pairs would double the catalogue and misdescribe what is
 * actually on disk.
 *
 * There is deliberately **no size field**. ML Kit does not report model sizes
 * through its API, and the figure in its documentation is prose. Leaving the
 * field out entirely — rather than optional — means no screen can ever render
 * a number we invented.
 */

/** What a pack looks like to a user, collapsed from the model lifecycle. */
export type LanguagePackState = 'not_downloaded' | 'downloading' | 'ready' | 'failed';

export type LanguagePack = {
  /** The runtime's own model id. Download and remove are called with this. */
  modelId: string;
  language: LanguageId;
  /** Catalogue display name; the catalogue stays the only source of names. */
  name: string;
  nativeName: string;
  state: LanguagePackState;
};

/**
 * The lifecycle has seven states; a user needs four.
 *
 * `installed`, `loading` and `unloading` all collapse into `ready` because ML
 * Kit owns residency: once the files are down, the language is usable, and
 * showing a separate "loading" step would describe our state machine rather
 * than anything the user can act on.
 */
export function toPackState(status: OfflineModelStatus): LanguagePackState {
  switch (status) {
    case 'downloading':
      return 'downloading';
    case 'installed':
    case 'loading':
    case 'ready':
    case 'unloading':
      return 'ready';
    case 'error':
      return 'failed';
    case 'not_installed':
      return 'not_downloaded';
  }
}

/**
 * In-flight states the registry cannot know.
 *
 * A download in progress and a download that just failed live in the screen,
 * not on disk, so they are overlaid here rather than written back into the
 * runtime's own view of the world.
 */
export type PackOverrides = Readonly<Record<string, 'downloading' | 'failed'>>;

/**
 * Turns runtime models into packs, in catalogue display order.
 *
 * Models whose language the catalogue does not know are dropped rather than
 * shown under a raw code: the catalogue is authoritative for identity, and a
 * runtime naming something it does not contain is a mapping bug.
 */
export function toLanguagePacks(
  models: readonly OfflineModel[],
  overrides: PackOverrides = {},
): LanguagePack[] {
  const packs: LanguagePack[] = [];

  for (const model of models) {
    const language = getLanguage(model.language);
    if (!language) continue;

    packs.push({
      modelId: model.id,
      language: model.language,
      name: language.name,
      nativeName: language.nativeName,
      state: overrides[model.id] ?? toPackState(model.status),
    });
  }

  return packs.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Languages a pair needs, given what the user picked.
 *
 * Exists so the screen can say "you also need German" without reimplementing
 * the per-language rule. Order is source then target, deduplicated.
 */
export function packsRequiredForPair(source: LanguageId, target: LanguageId): LanguageId[] {
  return source === target ? [source] : [source, target];
}
