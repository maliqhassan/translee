import { apiError, fail, ok, type Result } from '../http/api-error';

/**
 * The Transee API contract.
 *
 * This is the only shape the mobile app knows. A provider's request or
 * response format must never reach it — that is the whole point of the
 * backend sitting in the middle.
 *
 *   POST /translation
 *   { "sourceLanguage": "en", "targetLanguage": "de", "text": "Hello" }
 *   -> { "translatedText": "Hallo", "sourceLanguage": "en",
 *        "targetLanguage": "de", "detectedLanguage"?: "en" }
 */

export type TranslationApiRequest = {
  /** A Transee LanguageId, or `auto` to let the provider detect. */
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
};

export type TranslationApiResponse = {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  /** Present only when the source was `auto` and detection succeeded. */
  detectedLanguage?: string;
};

export const AUTO_DETECT = 'auto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): Result<string> {
  const value = record[key];
  if (typeof value !== 'string') {
    return fail(
      apiError(
        'invalid_request',
        `Field "${key}" must be a string${value === undefined ? ' and is missing' : ''}.`,
      ),
    );
  }
  return ok(value);
}

export type ParseOptions = {
  maxTextLength: number;
  /** Decides whether a LanguageId can be routed to the provider at all. */
  isSupported: (languageId: string) => boolean;
};

/**
 * Validates an incoming request. Nothing from the client is trusted: types,
 * emptiness, length and language support are all checked before a provider is
 * ever contacted.
 */
export function parseTranslationRequest(
  payload: unknown,
  options: ParseOptions,
): Result<TranslationApiRequest> {
  if (!isRecord(payload)) {
    return fail(apiError('invalid_request', 'Request body must be a JSON object.'));
  }

  const source = readString(payload, 'sourceLanguage');
  if (!source.ok) return source;

  const target = readString(payload, 'targetLanguage');
  if (!target.ok) return target;

  const text = readString(payload, 'text');
  if (!text.ok) return text;

  const trimmed = text.value.trim();

  if (trimmed.length === 0) {
    return fail(apiError('invalid_request', 'Field "text" must not be empty.'));
  }

  if (trimmed.length > options.maxTextLength) {
    return fail(
      apiError(
        'text_too_long',
        `Field "text" is ${trimmed.length} characters; the limit is ${options.maxTextLength}.`,
      ),
    );
  }

  // `auto` is a valid source but never a valid target.
  if (target.value === AUTO_DETECT) {
    return fail(apiError('invalid_request', 'Field "targetLanguage" cannot be "auto".'));
  }

  if (source.value !== AUTO_DETECT && !options.isSupported(source.value)) {
    return fail(
      apiError('unsupported_language', `Source language "${source.value}" is not supported.`),
    );
  }

  if (!options.isSupported(target.value)) {
    return fail(
      apiError('unsupported_language', `Target language "${target.value}" is not supported.`),
    );
  }

  // Same-to-same is a no-op the provider would charge us for.
  if (source.value === target.value) {
    return fail(apiError('invalid_request', 'Source and target languages must be different.'));
  }

  return ok({
    sourceLanguage: source.value,
    targetLanguage: target.value,
    text: trimmed,
  });
}
