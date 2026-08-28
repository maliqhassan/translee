import { DEFAULTS, getLanguage } from '@/constants';
import type { AppError, LanguageId, TranslationRequest, TranslationSource } from '@/types';
import { appError, err, ok, type Result } from '@/utils';

/**
 * A request that has passed validation. Carrying a distinct type means an
 * engine cannot accidentally be handed raw, untrimmed user input.
 */
export type NormalizedTranslationRequest = {
  text: string;
  sourceLanguage: LanguageId;
  targetLanguage: LanguageId;
  origin: TranslationSource;
};

/**
 * Trims and validates, and does nothing else.
 *
 * Only surrounding whitespace is removed. Internal spacing, line breaks and
 * punctuation are the user's content: collapsing them would quietly translate
 * something other than what was typed.
 */
export function normalizeTranslationRequest(
  request: TranslationRequest,
): Result<NormalizedTranslationRequest, AppError> {
  const text = request.text.trim();

  if (text.length === 0) {
    return err(appError('invalid_request', 'There is no text to translate.'));
  }

  if (text.length > DEFAULTS.maxInputLength) {
    return err(
      appError(
        'invalid_request',
        `Text is ${text.length} characters; the limit is ${DEFAULTS.maxInputLength}.`,
      ),
    );
  }

  // Both sides must name a catalogue entry, or no engine could resolve them.
  if (!getLanguage(request.sourceLanguage)) {
    return err(
      appError('unsupported_language', `Unknown source language ${request.sourceLanguage}.`),
    );
  }

  if (!getLanguage(request.targetLanguage)) {
    return err(
      appError('unsupported_language', `Unknown target language ${request.targetLanguage}.`),
    );
  }

  return ok({
    text,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    origin: request.origin,
  });
}

/**
 * ASCII unit separator. It cannot appear in a language id and will not appear
 * in typed text, so no two distinct requests can collide on the joined key.
 */
const KEY_SEPARATOR = String.fromCharCode(31);

/**
 * Deterministic key over the three things that decide a translation.
 *
 * `origin` is excluded on purpose: the same sentence typed or spoken
 * translates the same, and sharing that entry is the point of the cache.
 */
export function translationCacheKey(request: NormalizedTranslationRequest): string {
  return [request.sourceLanguage, request.targetLanguage, request.text].join(KEY_SEPARATOR);
}
