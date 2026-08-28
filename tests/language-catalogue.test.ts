import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULTS } from '@/constants/config';
import {
  LANGUAGES,
  POPULAR_LANGUAGES,
  SOURCE_LANGUAGES,
  TARGET_LANGUAGES,
  getLanguage,
  isAutoDetect,
  languageName,
  languageShortCode,
  searchLanguages,
} from '@/constants/languages';
import {
  describeOfflineSupport,
  isPairOfflineCapableById,
  languagePackId,
} from '@/services/language-packs/language-availability';
import {
  applySource,
  applySwap,
  applyTarget,
  canSwap,
  remember,
} from '@/store/language-pair-rules';
import type { LanguagePair } from '@/types';

/** Day 3 behaviour, kept as regression cover for later days. */

describe('language catalogue', () => {
  it('has a production-sized catalogue', () => {
    assert.ok(LANGUAGES.length >= 50, `expected 50+, got ${LANGUAGES.length}`);
  });

  it('has unique ids', () => {
    assert.equal(new Set(LANGUAGES.map((l) => l.id)).size, LANGUAGES.length);
  });

  it('gives every entry the full model', () => {
    for (const language of LANGUAGES) {
      assert.ok(language.id && language.code && language.name && language.nativeName, language.id);
      assert.equal(typeof language.isPopular, 'boolean');
      assert.equal(typeof language.supportsOnline, 'boolean');
      assert.equal(typeof language.offline.supported, 'boolean');
      assert.ok(language.direction === 'ltr' || language.direction === 'rtl');
    }
  });

  it('claims no offline model until one is chosen', () => {
    assert.ok(LANGUAGES.every((l) => l.offline.supported === false));
  });

  it('keeps script variants distinct but on a shared base code', () => {
    assert.equal(getLanguage('zh-Hans')?.code, 'zh');
    assert.equal(getLanguage('zh-Hant')?.code, 'zh');
    assert.equal(getLanguage('pt-BR')?.code, 'pt');
    assert.notEqual(getLanguage('zh-Hans')?.name, getLanguage('zh-Hant')?.name);
  });

  it('marks right-to-left scripts', () => {
    for (const id of ['ar', 'he', 'fa', 'ur']) {
      assert.equal(getLanguage(id)?.direction, 'rtl', id);
    }
  });

  it('separates source and target pools', () => {
    assert.equal(SOURCE_LANGUAGES.length, LANGUAGES.length + 1);
    assert.ok(!TARGET_LANGUAGES.some((l) => isAutoDetect(l.id)));
    assert.ok(SOURCE_LANGUAGES.some((l) => isAutoDetect(l.id)));
  });

  it('offers a popular shortlist', () => {
    assert.ok(POPULAR_LANGUAGES.length > 0);
    assert.ok(POPULAR_LANGUAGES.every((l) => l.isPopular));
  });

  it('defaults to English to German', () => {
    assert.equal(DEFAULTS.sourceLanguage, 'en');
    assert.equal(DEFAULTS.targetLanguage, 'de');
  });
});

describe('language selectors', () => {
  const ids = (list: readonly { id: string }[]) => list.map((l) => l.id);

  it('searches by English name, native name and code', () => {
    assert.deepEqual(ids(searchLanguages(SOURCE_LANGUAGES, 'german')), ['de']);
    assert.deepEqual(ids(searchLanguages(SOURCE_LANGUAGES, 'deutsch')), ['de']);
    assert.ok(ids(searchLanguages(SOURCE_LANGUAGES, 'ur')).includes('ur'));
  });

  it('ignores accents', () => {
    assert.deepEqual(ids(searchLanguages(SOURCE_LANGUAGES, 'espanol')), ['es']);
    assert.deepEqual(ids(searchLanguages(SOURCE_LANGUAGES, 'francais')), ['fr']);
  });

  it('searches native scripts', () => {
    assert.deepEqual(ids(searchLanguages(SOURCE_LANGUAGES, '日本語')), ['ja']);
    assert.deepEqual(ids(searchLanguages(SOURCE_LANGUAGES, 'العربية')), ['ar']);
  });

  it('returns the whole pool for an empty query and nothing for a bad one', () => {
    assert.equal(searchLanguages(SOURCE_LANGUAGES, '').length, SOURCE_LANGUAGES.length);
    assert.equal(searchLanguages(SOURCE_LANGUAGES, '   ').length, SOURCE_LANGUAGES.length);
    assert.equal(searchLanguages(SOURCE_LANGUAGES, 'zzzzz').length, 0);
  });

  it('resolves names and codes safely', () => {
    assert.equal(getLanguage('auto')?.name, 'Detect language');
    assert.equal(getLanguage('nope'), undefined);
    assert.equal(languageName('nope'), 'nope');
    assert.equal(languageShortCode('zh-Hans'), 'ZH-HANS');
  });
});

describe('language pair rules', () => {
  const routes: [string, string][] = [
    ['en', 'de'],
    ['de', 'en'],
    ['en', 'es'],
    ['es', 'fr'],
    ['ja', 'en'],
    ['ur', 'en'],
    ['ar', 'fr'],
  ];

  it('reaches every required route', () => {
    for (const [source, target] of routes) {
      let pair: LanguagePair = {
        source: DEFAULTS.sourceLanguage,
        target: DEFAULTS.targetLanguage,
      };
      pair = applySource(pair, source);
      pair = applyTarget(pair, target);
      assert.deepEqual(pair, { source, target });
      assert.ok(getLanguage(pair.source), source);
      assert.ok(getLanguage(pair.target), target);
    }
  });

  it('swaps rather than allowing a same-to-same pair', () => {
    assert.deepEqual(applySource({ source: 'en', target: 'de' }, 'de'), {
      source: 'de',
      target: 'en',
    });
    assert.deepEqual(applyTarget({ source: 'en', target: 'de' }, 'en'), {
      source: 'de',
      target: 'en',
    });
  });

  it('swaps symmetrically and refuses to swap auto-detect', () => {
    assert.deepEqual(applySwap({ source: 'en', target: 'de' }), { source: 'de', target: 'en' });
    assert.deepEqual(applySwap(applySwap({ source: 'en', target: 'de' })), {
      source: 'en',
      target: 'de',
    });
    assert.deepEqual(applySwap({ source: 'auto', target: 'de' }), { source: 'auto', target: 'de' });
    assert.equal(canSwap({ source: 'auto', target: 'de' }), false);
    assert.equal(canSwap({ source: 'en', target: 'de' }), true);
  });

  it('tracks recents newest-first, de-duplicated and capped', () => {
    assert.deepEqual(remember(remember([], 'de'), 'fr'), ['fr', 'de']);
    assert.deepEqual(remember(['de', 'fr', 'es'], 'es'), ['es', 'de', 'fr']);
    assert.deepEqual(remember(['de'], 'auto'), ['de']);

    let recents: readonly string[] = [];
    for (const id of ['de', 'fr', 'es', 'it', 'ja', 'ko', 'ru', 'ar']) {
      recents = remember(recents, id);
    }
    assert.equal(recents.length, 6);
    assert.equal(recents[0], 'ar');
  });
});

describe('offline availability seam', () => {
  it('builds directed pack ids that keep variants distinct', () => {
    assert.equal(languagePackId('en', 'de'), 'en-de');
    assert.equal(languagePackId('zh-Hans', 'en'), 'zh-Hans-en');
    assert.notEqual(languagePackId('en', 'de'), languagePackId('de', 'en'));
  });

  it('reports nothing as offline-ready yet', () => {
    const german = getLanguage('de');
    assert.ok(german);
    const availability = describeOfflineSupport(german);
    assert.equal(availability.modelAvailable, false);
    assert.equal(availability.packStatus, 'not_installed');
    assert.equal(availability.readyOffline, false);
    assert.equal(isPairOfflineCapableById('en', 'de'), false);
    assert.equal(isPairOfflineCapableById('en', 'nope'), false);
  });

  it('carries a reported pack status through', () => {
    const german = getLanguage('de');
    assert.ok(german);
    assert.equal(describeOfflineSupport(german, 'installed').packStatus, 'installed');
  });
});
