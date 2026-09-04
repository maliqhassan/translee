import { isAutoDetect } from '@/constants';
import type { LanguageId } from '@/types';

/**
 * Why on-device translation can or cannot serve a given pair.
 *
 * The engine already refuses correctly at every one of these points; what it
 * cannot do is say so *before* a user presses Translate, or distinguish "you
 * need the German pack" from "this language never works offline". Both matter
 * to a screen, and neither is safe to infer from an error code alone —
 * `model_missing` covers a missing source model, a missing target model and a
 * runtime that is not in the build at all.
 *
 * So the question is answered once, here, as a pure function of what the
 * runtime reported. Nothing in this file performs I/O, invents a language, or
 * knows that the runtime is ML Kit.
 */

export type OfflineReadiness =
  /** Both models are on the device; a translation would run locally. */
  | { kind: 'ready' }
  /** No on-device runtime in this build. Downloading cannot help. */
  | { kind: 'runtime_missing' }
  /** Detect-language has no on-device model, so the source must be explicit. */
  | { kind: 'source_undetectable' }
  /** The runtime cannot serve these languages at all, downloaded or not. */
  | { kind: 'unsupported'; languages: readonly LanguageId[] }
  /** These packs would make the pair work, and can be downloaded. */
  | { kind: 'packs_missing'; languages: readonly LanguageId[] };

export type OfflineReadinessInput = {
  /** Whether the native runtime is present in this build. */
  runtimeAvailable: boolean;
  /** Every language the runtime could serve, installed or not. */
  supported: readonly LanguageId[];
  /** Languages whose model is actually on the device right now. */
  downloaded: readonly LanguageId[];
  source: LanguageId;
  target: LanguageId;
};

/**
 * The order of these checks is the order in which they can be acted on.
 *
 * A missing runtime is checked first because no download fixes it; an
 * unsupported language before a missing pack, because offering to download a
 * pack that cannot exist would be a dead end.
 */
export function offlineReadiness(input: OfflineReadinessInput): OfflineReadiness {
  const { runtimeAvailable, source, target } = input;

  if (!runtimeAvailable) return { kind: 'runtime_missing' };

  // `auto` is not a translation model. Language identification is a separate
  // runtime capability this build does not include, so an explicit source is
  // required rather than a guess.
  if (isAutoDetect(source)) return { kind: 'source_undetectable' };

  const supported = new Set(input.supported);
  const downloaded = new Set(input.downloaded);
  const needed = requiredPacks(source, target);

  const unsupported = needed.filter((language) => !supported.has(language));
  if (unsupported.length > 0) return { kind: 'unsupported', languages: unsupported };

  const missing = needed.filter((language) => !downloaded.has(language));
  if (missing.length > 0) return { kind: 'packs_missing', languages: missing };

  return { kind: 'ready' };
}

/**
 * The languages a pair needs on the device, source first.
 *
 * One per language, never one per direction: the runtime keys models by
 * language, so English plus German is what makes both `en -> de` and
 * `de -> en` work.
 */
export function requiredPacks(source: LanguageId, target: LanguageId): LanguageId[] {
  return source === target ? [source] : [source, target];
}

/** Whether pointing the user at the packs screen would actually help. */
export function isDownloadable(readiness: OfflineReadiness): boolean {
  return readiness.kind === 'packs_missing';
}
