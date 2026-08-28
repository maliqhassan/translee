import type { LanguageId } from '@/types';
import { err, ok } from '@/utils';

import { httpStatusError, type HttpClient } from '../../http';
import type { ServiceResult } from '../../types';
import type { NormalizedTranslationRequest } from '../translation-request';

import { backendAdapter } from './backend-adapter';
import type {
  ProviderAdapter,
  ProviderTranslation,
  TranslationProvider,
} from './translation-provider';

export type BackendProviderOptions = {
  /** Public base URL. Undefined means the provider reports itself unconfigured. */
  baseUrl?: string;
  translatePath: string;
  http: HttpClient;
  /** Swappable so a changed response shape is an adapter change only. */
  adapter?: ProviderAdapter;
};

/**
 * Talks to the Transee backend, which holds the provider credential.
 *
 * The app sends only the language pair and the text. It never sends, stores or
 * knows a provider API key — that stays server-side, which is the whole reason
 * this indirection exists.
 */
export function createBackendTranslationProvider(
  options: BackendProviderOptions,
): TranslationProvider {
  const adapter = options.adapter ?? backendAdapter;
  const configured = typeof options.baseUrl === 'string' && options.baseUrl.length > 0;

  const endpoint = () => `${(options.baseUrl ?? '').replace(/\/+$/, '')}${options.translatePath}`;

  return {
    name: adapter.provider,

    isConfigured() {
      return configured;
    },

    async supportsPair(source: LanguageId, target: LanguageId) {
      // The backend decides what it can handle; the app only refuses the pairs
      // it can prove are wrong. Anything else is the server's call.
      return configured && source !== target;
    },

    async translate(request: NormalizedTranslationRequest): ServiceResult<ProviderTranslation> {
      if (!configured) {
        return err(httpStatusError(503, 'No Transee backend URL is configured for this build.'));
      }

      const response = await options.http.send({
        url: endpoint(),
        method: 'POST',
        body: {
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
          text: request.text,
        },
      });

      // Transport failure: already an AppError, pass it through untouched.
      if (!response.ok) return response;

      const { status, ok: succeeded, data } = response.value;
      if (!succeeded) return err(httpStatusError(status));

      const translation = adapter.toTranslation(data);
      if (!translation.ok) return translation;

      return ok(translation.value);
    },
  };
}
