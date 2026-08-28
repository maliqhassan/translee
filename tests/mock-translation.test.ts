import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MOCK_LANGUAGES,
  fromEnglishKey,
  normalizePhrase,
  toEnglishKey,
} from '@/services/translation/mock/demo-phrases';
import { mockTranslationService } from '@/services/translation/mock-translation-service';
import type { TranslationRequest } from '@/types';

/** Day 2 behaviour. The sample engine must keep working for development. */

const request = (over: Partial<TranslationRequest> = {}): TranslationRequest => ({
  text: 'Hello',
  sourceLanguage: 'en',
  targetLanguage: 'de',
  origin: 'text',
  ...over,
});

describe('demo phrase lookup', () => {
  const lookup = (source: string, target: string, text: string) => {
    const key = toEnglishKey(source, text);
    return key ? (fromEnglishKey(key, target) ?? text) : text;
  };

  it('translates known phrases', () => {
    assert.equal(lookup('en', 'de', 'Hello'), 'Hallo');
    assert.equal(lookup('en', 'es', 'Thank you'), 'Gracias');
    assert.equal(lookup('en', 'ja', 'Good morning'), 'おはようございます');
  });

  it('is forgiving about case and trailing punctuation', () => {
    assert.equal(lookup('en', 'de', 'hello!'), 'Hallo');
    assert.equal(normalizePhrase('  Hello!!  '), 'hello');
  });

  it('pivots between two non-English languages', () => {
    assert.equal(lookup('de', 'es', 'Hallo'), 'Hola');
    assert.equal(lookup('es', 'fr', '¿Cómo estás?'), 'Comment allez-vous');
  });

  it('returns English in sentence case', () => {
    assert.equal(lookup('de', 'en', 'Danke'), 'Thank you');
  });

  it('echoes unknown text rather than inventing a translation', () => {
    assert.equal(lookup('en', 'de', 'unmatched sentence here'), 'unmatched sentence here');
  });

  it('covers a small fixed language set', () => {
    assert.deepEqual([...MOCK_LANGUAGES], ['en', 'de', 'es', 'fr', 'it', 'ja']);
  });
});

describe('mock translation service', () => {
  it('is always available, so development works without a backend', async () => {
    assert.equal(await mockTranslationService.isAvailable(), true);
  });

  it('produces a complete TranslationResult', async () => {
    const result = await mockTranslationService.translate(request());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.translatedText, 'Hallo');
    assert.equal(result.value.sourceText, 'Hello');
    assert.equal(result.value.engine, 'mock');
    assert.equal(result.value.sourceLanguage, 'en');
    assert.equal(result.value.targetLanguage, 'de');
    assert.ok(result.value.id.startsWith('tr_'));
  });

  it('resolves catalogue variants onto their base code', async () => {
    // zh-Hans maps to zh, which the sample engine has no data for.
    assert.equal(await mockTranslationService.supportsPair('en', 'zh-Hans'), false);
    assert.equal(await mockTranslationService.supportsPair('en', 'de'), true);
  });

  it('rejects a pair it has no data for', async () => {
    const result = await mockTranslationService.translate(request({ targetLanguage: 'sw' }));
    assert.equal(!result.ok && result.error.code, 'unsupported_language');
  });

  it('rejects empty text', async () => {
    const result = await mockTranslationService.translate(request({ text: '   ' }));
    assert.equal(result.ok, false);
  });

  it('treats auto-detect as English', async () => {
    const result = await mockTranslationService.translate(request({ sourceLanguage: 'auto' }));
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.detectedLanguage, 'en');
  });
});
