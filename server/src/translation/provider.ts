import type { Result } from '../http/api-error';

/**
 * A translation provider, as the backend sees it.
 *
 * Everything provider-specific — endpoint, auth header, request shape,
 * response shape, error codes — lives behind this interface. Swapping Azure
 * for DeepL or Google is a new file implementing this and one line in the
 * registry; no handler, contract or mobile change.
 */

export type ProviderRequest = {
  text: string;
  /** Provider code, already mapped. Undefined means "detect the source". */
  sourceCode?: string;
  /** Provider code, already mapped. */
  targetCode: string;
};

export type ProviderResult = {
  translatedText: string;
  /** Provider code of the detected source, when it reported one. */
  detectedCode?: string;
};

export type TranslationProvider = {
  readonly name: string;
  /** False when the provider lacks the configuration it needs to run. */
  isConfigured(): boolean;
  translate(request: ProviderRequest): Promise<Result<ProviderResult>>;
};
