import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTranslationRequest } from '../src/translation/contract';
import {
  createLanguageResolver,
  loadLanguageMap,
  parseLanguageMap,
} from '../src/translation/language-map';

const languages = createLanguageResolver(loadLanguageMap());
const options = { maxTextLength: 5000, isSupported: (id: string) => languages.isSupported(id) };

const valid = { sourceLanguage: 'en', targetLanguage: 'de', text: 'Hello' };

describe('request validation', () => {
  it('accepts a valid request', () => {
    const result = parseTranslationRequest(valid, options);
    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.value, valid);
  });

  it('trims surrounding whitespace', () => {
    const result = parseTranslationRequest({ ...valid, text: '  Hello  ' }, options);
    assert.equal(result.ok && result.value.text, 'Hello');
  });

  it('rejects empty and whitespace-only text', () => {
    for (const text of ['', '   ', '\n\t ']) {
      const result = parseTranslationRequest({ ...valid, text }, options);
      assert.equal(result.ok, false, JSON.stringify(text));
      assert.equal(!result.ok && result.error.code, 'invalid_request');
    }
  });

  it('rejects oversized text', () => {
    const result = parseTranslationRequest({ ...valid, text: 'a'.repeat(5001) }, options);
    assert.equal(!result.ok && result.error.code, 'text_too_long');
  });

  it('accepts text exactly at the limit', () => {
    assert.equal(parseTranslationRequest({ ...valid, text: 'a'.repeat(5000) }, options).ok, true);
  });

  it('rejects an unsupported source language', () => {
    // Javanese is in the catalogue but the provider cannot translate it.
    const result = parseTranslationRequest({ ...valid, sourceLanguage: 'jv' }, options);
    assert.equal(!result.ok && result.error.code, 'unsupported_language');
  });

  it('rejects an unsupported target language', () => {
    const result = parseTranslationRequest({ ...valid, targetLanguage: 'tg' }, options);
    assert.equal(!result.ok && result.error.code, 'unsupported_language');
  });

  it('rejects an unknown language entirely', () => {
    const result = parseTranslationRequest({ ...valid, targetLanguage: 'not-a-language' }, options);
    assert.equal(!result.ok && result.error.code, 'unsupported_language');
  });

  it('rejects malformed bodies', () => {
    const malformed: unknown[] = [
      null,
      'a string',
      42,
      [],
      {},
      { sourceLanguage: 'en' },
      { sourceLanguage: 'en', targetLanguage: 'de' },
      { sourceLanguage: 1, targetLanguage: 'de', text: 'Hello' },
      { sourceLanguage: 'en', targetLanguage: 'de', text: 123 },
      { sourceLanguage: 'en', targetLanguage: null, text: 'Hello' },
    ];
    for (const payload of malformed) {
      const result = parseTranslationRequest(payload, options);
      assert.equal(result.ok, false, `should reject ${JSON.stringify(payload)}`);
      assert.equal(!result.ok && result.error.code, 'invalid_request');
    }
  });

  it('accepts auto as a source but never as a target', () => {
    assert.equal(parseTranslationRequest({ ...valid, sourceLanguage: 'auto' }, options).ok, true);
    const asTarget = parseTranslationRequest({ ...valid, targetLanguage: 'auto' }, options);
    assert.equal(!asTarget.ok && asTarget.error.code, 'invalid_request');
  });

  it('rejects a same-to-same pair', () => {
    const result = parseTranslationRequest({ ...valid, targetLanguage: 'en' }, options);
    assert.equal(!result.ok && result.error.code, 'invalid_request');
  });

  it('accepts script and region variants', () => {
    for (const [source, target] of [
      ['zh-Hans', 'en'],
      ['zh-Hant', 'en'],
      ['pt-BR', 'de'],
      ['pt-PT', 'de'],
      ['ur', 'en'],
      ['ar', 'fr'],
    ]) {
      const result = parseTranslationRequest(
        { sourceLanguage: source as string, targetLanguage: target as string, text: 'Hello' },
        options,
      );
      assert.equal(result.ok, true, `${source} -> ${target}`);
    }
  });
});

describe('language map', () => {
  it('maps LanguageIds to provider codes', () => {
    assert.equal(languages.toProviderCode('en'), 'en');
    assert.equal(languages.toProviderCode('de'), 'de');
  });

  it('collapses region variants onto the provider code', () => {
    // Azure's bare `pt` is Brazilian Portuguese.
    assert.equal(languages.toProviderCode('pt-BR'), 'pt');
    assert.equal(languages.toProviderCode('pt-PT'), 'pt-PT');
  });

  it('keeps script variants distinct', () => {
    assert.equal(languages.toProviderCode('zh-Hans'), 'zh-Hans');
    assert.equal(languages.toProviderCode('zh-Hant'), 'zh-Hant');
    assert.notEqual(languages.toProviderCode('zh-Hans'), languages.toProviderCode('zh-Hant'));
  });

  it('picks the script the catalogue endonym implies', () => {
    assert.equal(languages.toProviderCode('sr'), 'sr-Cyrl');
    assert.equal(languages.toProviderCode('mn'), 'mn-Cyrl');
  });

  it('treats auto as supported but gives it no provider code', () => {
    assert.equal(languages.isSupported('auto'), true);
    assert.equal(languages.toProviderCode('auto'), undefined);
  });

  it('reports catalogue languages the provider cannot handle', () => {
    for (const id of ['jv', 'tg']) {
      assert.equal(languages.isSupported(id), false, id);
      assert.equal(languages.toProviderCode(id), undefined, id);
    }
  });

  it('covers most of the catalogue', () => {
    assert.ok(languages.supportedIds().length >= 85);
  });

  it('rejects a malformed map rather than starting with a broken table', () => {
    for (const bad of [null, 42, {}, { languages: {} }, { languages: { en: 5 } }]) {
      assert.throws(() => parseLanguageMap(bad), `should reject ${JSON.stringify(bad)}`);
    }
  });
});
