import type {
  LanguageCode,
  TranslationEngine,
  TranslationRequest,
  TranslationResult,
} from '@/types';

import type { Service, ServiceResult } from '../types';

export type DetectedLanguage = {
  code: LanguageCode;
  /** 0–1. Engines that cannot score a guess should report 1. */
  confidence: number;
};

/**
 * Contract shared by every translation engine. The screens depend on this type
 * only — never on a concrete engine — so online/offline can be swapped freely.
 */
export type TranslationService = Service & {
  readonly engine: TranslationEngine;
  translate(request: TranslationRequest): ServiceResult<TranslationResult>;
  detectLanguage(text: string): ServiceResult<DetectedLanguage>;
  /** Pairs this engine can currently handle. */
  supportsPair(source: LanguageCode, target: LanguageCode): Promise<boolean>;
};

/**
 * Chooses between engines per request (network state, user preference, whether
 * a language pack is installed). Implemented on the offline-routing day.
 */
export type TranslationRouter = {
  translate(request: TranslationRequest): ServiceResult<TranslationResult>;
  /** Which engine `translate` would pick right now, for UI badges. */
  resolveEngine(request: TranslationRequest): Promise<TranslationEngine>;
};
