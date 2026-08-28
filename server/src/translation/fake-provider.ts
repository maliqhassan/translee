import { ok, type Result } from '../http/api-error';

import type { ProviderRequest, ProviderResult, TranslationProvider } from './provider';

/**
 * A deterministic stand-in used when no credential is configured.
 *
 * It exists so the backend can be run, exercised and tested end to end without
 * an Azure account or spending quota. It never pretends to translate: the
 * output is visibly marked, so a fake result can never be mistaken for a real
 * one in development.
 */
export function createFakeProvider(): TranslationProvider {
  return {
    name: 'fake',

    isConfigured() {
      return true;
    },

    async translate(request: ProviderRequest): Promise<Result<ProviderResult>> {
      return ok({
        translatedText: `[${request.targetCode}] ${request.text}`,
        detectedCode: request.sourceCode ?? 'en',
      });
    },
  };
}
