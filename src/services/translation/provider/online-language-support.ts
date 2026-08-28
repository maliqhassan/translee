import { AUTO_DETECT_ID } from '@/constants';
import type { LanguageId } from '@/types';
import providerLanguages from '@shared/provider-languages.json';

/**
 * Which catalogue languages the configured online provider can actually
 * translate.
 *
 * Day 3 made the catalogue the source of truth for *application* languages.
 * Provider support is a separate question with a different answer, so it lives
 * in a generated table rather than as a flag on the catalogue — see
 * `scripts/sync-provider-languages.mjs`.
 *
 * The backend validates independently and is authoritative. This check exists
 * only so an unsupported pair fails instantly instead of after a round trip.
 */

const SUPPORTED: ReadonlySet<LanguageId> = new Set(Object.keys(providerLanguages.languages));

export const ONLINE_PROVIDER_NAME: string = providerLanguages.provider;

/** Catalogue languages the provider cannot handle, for docs and diagnostics. */
export const ONLINE_UNSUPPORTED: readonly LanguageId[] = providerLanguages.unsupported;

export function isOnlineSupported(id: LanguageId): boolean {
  // Detection is a provider capability, not a language, and is always allowed
  // as a source.
  return id === AUTO_DETECT_ID || SUPPORTED.has(id);
}

export function isOnlinePairSupported(source: LanguageId, target: LanguageId): boolean {
  // A same-to-same pair is a no-op the backend would reject anyway.
  if (source === target) return false;
  if (target === AUTO_DETECT_ID) return false;
  return isOnlineSupported(source) && isOnlineSupported(target);
}

export function onlineSupportedCount(): number {
  return SUPPORTED.size;
}
