import { apiError, fail, ok, type Result } from '../http/api-error';

import { parseTranslationRequest, type TranslationApiResponse } from './contract';
import type { LanguageResolver } from './language-map';
import type { TranslationProvider } from './provider';

/**
 * The translation use case, independent of HTTP.
 *
 * Keeping it free of `IncomingMessage`/`ServerResponse` is what lets the whole
 * path — validation, mapping, provider call, normalisation — be tested
 * directly, with the transport tested separately.
 */

export type TranslateOptions = {
  provider: TranslationProvider;
  languages: LanguageResolver;
  maxTextLength: number;
};

/** Provider codes come back in the provider's vocabulary; map them home. */
function toLanguageId(
  providerCode: string | undefined,
  languages: LanguageResolver,
): string | undefined {
  if (!providerCode) return undefined;
  for (const id of languages.supportedIds()) {
    if (languages.toProviderCode(id) === providerCode) return id;
  }
  return undefined;
}

export async function handleTranslate(
  payload: unknown,
  options: TranslateOptions,
): Promise<Result<TranslationApiResponse>> {
  const parsed = parseTranslationRequest(payload, {
    maxTextLength: options.maxTextLength,
    isSupported: (id) => options.languages.isSupported(id),
  });
  if (!parsed.ok) return parsed;

  const request = parsed.value;
  const targetCode = options.languages.toProviderCode(request.targetLanguage);

  // Validation already accepted the target, so a missing code is our bug.
  if (!targetCode) {
    return fail(
      apiError(
        'unsupported_language',
        `Target language "${request.targetLanguage}" is not supported.`,
      ),
    );
  }

  if (!options.provider.isConfigured()) {
    return fail(apiError('provider_unavailable', 'Translation is not configured.'));
  }

  const translated = await options.provider.translate({
    text: request.text,
    sourceCode: options.languages.toProviderCode(request.sourceLanguage),
    targetCode,
  });
  if (!translated.ok) return translated;

  const detectedLanguage = toLanguageId(translated.value.detectedCode, options.languages);

  return ok({
    translatedText: translated.value.translatedText,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    // Only meaningful when the client asked us to detect.
    ...(request.sourceLanguage === 'auto' && detectedLanguage ? { detectedLanguage } : {}),
  });
}
