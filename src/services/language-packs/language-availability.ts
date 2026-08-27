import { getLanguage } from '@/constants';
import type { Language, LanguageId } from '@/types';

import type { LanguagePackStatus } from './language-pack-manager';

/**
 * The seam between static catalogue metadata and runtime pack state.
 *
 * Catalogue metadata (is there a model, what is it called, how big) lives on
 * the `Language`. Install state lives in `LanguagePackManager`. These pure
 * functions combine the two, so the download days can answer "can this run
 * offline?" without a screen ever reasoning about it. Nothing here performs
 * I/O — callers pass in the status they already hold.
 */

/** Canonical pack id for a directed pair, matching `LanguagePack.id`. */
export function languagePackId(source: LanguageId, target: LanguageId): string {
  return `${source}-${target}`;
}

export type OfflineLanguageAvailability = {
  languageId: LanguageId;
  /** The catalogue has an on-device model for this language. */
  modelAvailable: boolean;
  modelId?: string;
  approximateSizeMb?: number;
  /** Install state, defaulting to not installed until packs report otherwise. */
  packStatus: LanguagePackStatus;
  /** Usable offline right now: a model exists and its pack is installed. */
  readyOffline: boolean;
};

export function describeOfflineSupport(
  language: Language,
  packStatus: LanguagePackStatus = 'not_installed',
): OfflineLanguageAvailability {
  const modelAvailable = language.offline.supported;
  return {
    languageId: language.id,
    modelAvailable,
    modelId: language.offline.modelId,
    approximateSizeMb: language.offline.approximateSizeMb,
    packStatus,
    readyOffline: modelAvailable && packStatus === 'installed',
  };
}

/** Whether both sides of a pair have an on-device model at all. */
export function isPairOfflineCapable(source: Language, target: Language): boolean {
  return source.offline.supported && target.offline.supported;
}

/** Same question, by id, for callers that only hold the pair. */
export function isPairOfflineCapableById(source: LanguageId, target: LanguageId): boolean {
  const from = getLanguage(source);
  const to = getLanguage(target);
  return Boolean(from && to && isPairOfflineCapable(from, to));
}
