import type { LanguageCode } from './language';

/** Where a piece of text came from. Drives history icons and analytics. */
export type TranslationSource = 'text' | 'camera' | 'voice' | 'clipboard';

/**
 * Which engine produced a result. Surfaced to the user as a badge.
 *
 * `mock` is the temporary in-memory engine used while no real engine exists;
 * it is removed together with `FEATURES.mockTranslation`.
 */
export type TranslationEngine = 'online' | 'offline' | 'mock';

export type TranslationRequest = {
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  origin: TranslationSource;
};

export type TranslationResult = {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage: LanguageCode;
  /** Set when `sourceLanguage` was `auto` and the engine detected one. */
  detectedLanguage?: LanguageCode;
  targetLanguage: LanguageCode;
  engine: TranslationEngine;
  origin: TranslationSource;
  /** Epoch milliseconds. */
  createdAt: number;
};

export type HistoryEntry = TranslationResult & {
  isFavorite: boolean;
};
