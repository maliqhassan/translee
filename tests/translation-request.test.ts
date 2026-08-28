import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  normalizeTranslationRequest,
  translationCacheKey,
} from '@/services/translation/translation-request';
import type { TranslationRequest } from '@/types';

const base: TranslationRequest = {
  text: 'Hello',
  sourceLanguage: 'en',
  targetLanguage: 'de',
  origin: 'text',
};

describe('normalizeTranslationRequest', () => {
  it('accepts a valid request unchanged', () => {
    const result = normalizeTranslationRequest(base);
    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.value, {
      text: 'Hello',
      sourceLanguage: 'en',
      targetLanguage: 'de',
      origin: 'text',
    });
  });

  it('trims surrounding whitespace', () => {
    const result = normalizeTranslationRequest({ ...base, text: '   Hello world \n\t ' });
    assert.equal(result.ok && result.value.text, 'Hello world');
  });

  it('preserves the user’s internal formatting', () => {
    const text = 'Line one\n\nLine  two';
    const result = normalizeTranslationRequest({ ...base, text: `  ${text}  ` });
    assert.equal(result.ok && result.value.text, text);
  });

  it('rejects empty text', () => {
    const result = normalizeTranslationRequest({ ...base, text: '' });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, 'invalid_request');
  });

  it('rejects whitespace-only text', () => {
    const result = normalizeTranslationRequest({ ...base, text: '   \n\t  ' });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, 'invalid_request');
  });

  it('rejects text past the maximum length', () => {
    const result = normalizeTranslationRequest({ ...base, text: 'a'.repeat(5001) });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, 'invalid_request');
  });

  it('accepts text exactly at the maximum length', () => {
    const result = normalizeTranslationRequest({ ...base, text: 'a'.repeat(5000) });
    assert.equal(result.ok, true);
  });

  it('rejects an unknown source language', () => {
    const result = normalizeTranslationRequest({ ...base, sourceLanguage: 'not-a-language' });
    assert.equal(!result.ok && result.error.code, 'unsupported_language');
  });

  it('rejects an unknown target language', () => {
    const result = normalizeTranslationRequest({ ...base, targetLanguage: 'xx-Fake' });
    assert.equal(!result.ok && result.error.code, 'unsupported_language');
  });

  it('accepts catalogue variants and the auto sentinel', () => {
    for (const [source, target] of [
      ['auto', 'de'],
      ['zh-Hans', 'en'],
      ['pt-BR', 'ja'],
      ['ur', 'en'],
      ['ar', 'fr'],
    ]) {
      const result = normalizeTranslationRequest({
        ...base,
        sourceLanguage: source as string,
        targetLanguage: target as string,
      });
      assert.equal(result.ok, true, `${source} -> ${target} should be accepted`);
    }
  });
});

describe('translationCacheKey', () => {
  const key = (request: TranslationRequest) => {
    const normalized = normalizeTranslationRequest(request);
    assert.equal(normalized.ok, true);
    return normalized.ok ? translationCacheKey(normalized.value) : '';
  };

  it('is deterministic for the same request', () => {
    assert.equal(key(base), key({ ...base }));
  });

  it('ignores whitespace that normalisation removed', () => {
    assert.equal(key(base), key({ ...base, text: '  Hello  ' }));
  });

  it('ignores the origin, so typed and spoken share an entry', () => {
    assert.equal(key(base), key({ ...base, origin: 'voice' }));
  });

  it('differs on text, source and target', () => {
    assert.notEqual(key(base), key({ ...base, text: 'Goodbye' }));
    assert.notEqual(key(base), key({ ...base, sourceLanguage: 'auto' }));
    assert.notEqual(key(base), key({ ...base, targetLanguage: 'fr' }));
  });

  it('is case sensitive, because translations are', () => {
    assert.notEqual(key(base), key({ ...base, text: 'hello' }));
  });

  it('cannot be collided by text that looks like a delimiter', () => {
    const a = key({ ...base, sourceLanguage: 'en', targetLanguage: 'de', text: 'x' });
    const b = key({ ...base, sourceLanguage: 'en', targetLanguage: 'de', text: 'de x' });
    assert.notEqual(a, b);
  });
});
