import { DEFAULTS, getLanguage } from '@/constants';
import type { LanguageCode, LanguageId, TranslationRequest, TranslationResult } from '@/types';
import { appError, createId, err, ok } from '@/utils';

import type { ServiceResult } from '../types';

import { MOCK_LANGUAGES, fromEnglishKey, toEnglishKey } from './mock/demo-phrases';
import type { DetectedLanguage, TranslationService } from './translation-service';

/**
 * Stand-in engine used while no real translation backend exists.
 *
 * It exists so the whole UI path — loading, success, error, copy, history — can
 * be built and reviewed against the real `TranslationService` contract. Day 5
 * deletes this file and turns off `FEATURES.mockTranslation`; nothing in the
 * feature layer changes.
 */

/** Feels like a network round trip without being annoying, and is deterministic. */
function simulatedLatency(text: string): number {
  return 380 + Math.min(text.length * 8, 520);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMockLanguage(code: LanguageCode): boolean {
  return MOCK_LANGUAGES.includes(code);
}

/**
 * The pair carries catalogue ids; the demo dictionary is keyed by bare ISO
 * codes. Variants collapse onto their base code, so `zh-Hans` asks about `zh`.
 */
function toCode(id: LanguageId): LanguageCode {
  return getLanguage(id)?.code ?? id;
}

/** `auto` is resolved before lookup; the sample engine only ever guesses English. */
function resolveSource(id: LanguageId): LanguageCode {
  return id === 'auto' ? 'en' : toCode(id);
}

export const mockTranslationService: TranslationService = {
  id: 'translation.mock',
  engine: 'mock',

  async isAvailable() {
    return true;
  },

  async supportsPair(source: LanguageId, target: LanguageId) {
    return isMockLanguage(resolveSource(source)) && isMockLanguage(toCode(target));
  },

  async translate(request: TranslationRequest): ServiceResult<TranslationResult> {
    const text = request.text.trim();

    if (!text) {
      return err(appError('unknown', 'Nothing to translate.'));
    }

    if (text.length > DEFAULTS.maxInputLength) {
      return err(appError('unknown', 'Input exceeds the maximum length.'));
    }

    const source = resolveSource(request.sourceLanguage);
    const target = toCode(request.targetLanguage);

    if (!isMockLanguage(source) || !isMockLanguage(target)) {
      return err(
        appError('unsupported_language', `Sample engine has no data for ${source}/${target}.`),
      );
    }

    await delay(simulatedLatency(text));

    if (source === target) {
      return ok(buildResult(request, text, source));
    }

    // Known phrases pivot through English; anything else echoes back unchanged
    // and is flagged in the UI by the `mock` engine badge.
    const englishKey = toEnglishKey(source, text);
    const translated = englishKey ? fromEnglishKey(englishKey, target) : undefined;

    return ok(buildResult(request, translated ?? text, source));
  },

  async detectLanguage(text: string): ServiceResult<DetectedLanguage> {
    if (!text.trim()) {
      return err(appError('unknown', 'Nothing to detect.'));
    }
    // The sample engine cannot really detect anything; it says so with a low score.
    return ok({ code: 'en', confidence: 0.5 });
  },
};

function buildResult(
  request: TranslationRequest,
  translatedText: string,
  resolvedSource: LanguageId,
): TranslationResult {
  return {
    id: createId('tr'),
    sourceText: request.text.trim(),
    translatedText,
    sourceLanguage: request.sourceLanguage,
    detectedLanguage: request.sourceLanguage === 'auto' ? resolvedSource : undefined,
    targetLanguage: request.targetLanguage,
    engine: 'mock',
    origin: request.origin,
    createdAt: Date.now(),
  };
}
