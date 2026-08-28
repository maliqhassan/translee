import { apiError, fail, ok, type Result } from '../http/api-error';

import type { ProviderRequest, ProviderResult, TranslationProvider } from './provider';

/**
 * Azure AI Translator, v3 text translation.
 *
 * Chosen because it covers 87 of the catalogue's 89 languages and, unusually,
 * speaks the same script-qualified codes our LanguageIds already use
 * (`zh-Hans`, `zh-Hant`, `pt-PT`), so the mapping layer stays thin and honest.
 *
 * The subscription key is read from configuration and used only as a request
 * header. It is never logged, never echoed, and never included in any response
 * this module produces.
 *
 * Reference: https://learn.microsoft.com/azure/ai-services/translator/text-translation/reference/v3/translate
 */

const ENDPOINT = 'https://api.cognitive.microsofttranslator.com/translate';
const API_VERSION = '3.0';

export type AzureProviderOptions = {
  apiKey?: string;
  /** Required for regional resources; omitted for the global endpoint. */
  region?: string;
  timeoutMs: number;
  endpoint?: string;
  /** Injectable so tests drive the adapter without a network or credential. */
  fetchImpl?: typeof fetch;
};

/** Azure returns an array of results, one per input string. */
type AzureTranslation = { text?: unknown; to?: unknown };
type AzureResult = {
  translations?: unknown;
  detectedLanguage?: { language?: unknown; score?: unknown };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates the provider payload before any of it is trusted. A response that
 * parsed as JSON is not the same as a response that means what we expect.
 */
export function adaptAzureResponse(payload: unknown): Result<ProviderResult> {
  if (!Array.isArray(payload) || payload.length === 0) {
    return fail(apiError('provider_error', 'Translation provider returned no result.'));
  }

  const first: unknown = payload[0];
  if (!isRecord(first)) {
    return fail(apiError('provider_error', 'Translation provider returned an unexpected result.'));
  }

  const result = first as AzureResult;
  if (!Array.isArray(result.translations) || result.translations.length === 0) {
    return fail(apiError('provider_error', 'Translation provider returned no translations.'));
  }

  const translation: unknown = result.translations[0];
  if (!isRecord(translation)) {
    return fail(apiError('provider_error', 'Translation provider returned an unexpected result.'));
  }

  const { text } = translation as AzureTranslation;
  if (typeof text !== 'string' || text.length === 0) {
    return fail(apiError('provider_error', 'Translation provider returned empty text.'));
  }

  const detected = result.detectedLanguage?.language;

  return ok({
    translatedText: text,
    detectedCode: typeof detected === 'string' && detected.length > 0 ? detected : undefined,
  });
}

/** Maps the provider's HTTP status onto our own vocabulary. */
export function adaptAzureStatus(status: number): Result<never> {
  if (status === 429) {
    return fail(
      apiError('rate_limited', 'Translation is busy right now. Please try again shortly.'),
    );
  }
  if (status === 401 || status === 403) {
    // A credential problem is ours, not the caller's: never say which.
    return fail(apiError('provider_unavailable', 'Translation is temporarily unavailable.'));
  }
  if (status === 400 || status === 422) {
    return fail(apiError('unsupported_language', 'That language pair is not available.'));
  }
  if (status >= 500 || status === 408) {
    return fail(apiError('provider_unavailable', 'Translation is temporarily unavailable.'));
  }
  return fail(apiError('provider_error', 'Translation failed.'));
}

export function createAzureProvider(options: AzureProviderOptions): TranslationProvider {
  const doFetch = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? ENDPOINT;

  return {
    name: 'azure-translator',

    isConfigured() {
      return typeof options.apiKey === 'string' && options.apiKey.length > 0;
    },

    async translate(request: ProviderRequest): Promise<Result<ProviderResult>> {
      if (!options.apiKey) {
        return fail(apiError('provider_unavailable', 'Translation is not configured.'));
      }

      const url = new URL(endpoint);
      url.searchParams.set('api-version', API_VERSION);
      url.searchParams.set('to', request.targetCode);
      // Omitting `from` is how Azure is asked to detect the source.
      if (request.sourceCode) url.searchParams.set('from', request.sourceCode);

      const headers: Record<string, string> = {
        'Ocp-Apim-Subscription-Key': options.apiKey,
        'Content-Type': 'application/json; charset=UTF-8',
      };
      if (options.region) headers['Ocp-Apim-Subscription-Region'] = options.region;

      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, options.timeoutMs);

      try {
        const response = await doFetch(url.toString(), {
          method: 'POST',
          headers,
          body: JSON.stringify([{ text: request.text }]),
          signal: controller.signal,
        });

        if (!response.ok) return adaptAzureStatus(response.status);

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          return fail(apiError('provider_error', 'Translation provider returned invalid JSON.'));
        }

        return adaptAzureResponse(payload);
      } catch {
        // The cause is deliberately not forwarded: it can carry the request
        // URL and headers, and those include the subscription key.
        return fail(
          apiError(
            'provider_unavailable',
            timedOut ? 'Translation timed out.' : 'Translation is temporarily unavailable.',
          ),
        );
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
