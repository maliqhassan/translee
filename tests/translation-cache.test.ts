import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createInFlightRegistry } from '@/services/translation/in-flight-requests';
import {
  createMemoryTranslationCache,
  createNullTranslationCache,
} from '@/services/translation/translation-cache';
import type { NormalizedTranslationRequest } from '@/services/translation/translation-request';
import type { TranslationResult } from '@/types';

const request = (text: string, target = 'de'): NormalizedTranslationRequest => ({
  text,
  sourceLanguage: 'en',
  targetLanguage: target,
  origin: 'text',
});

const result = (translatedText: string): TranslationResult => ({
  id: `id-${translatedText}`,
  sourceText: 'source',
  translatedText,
  sourceLanguage: 'en',
  targetLanguage: 'de',
  engine: 'mock',
  origin: 'text',
  createdAt: 0,
});

describe('memory translation cache', () => {
  it('misses on an empty cache', async () => {
    const cache = createMemoryTranslationCache({ maxEntries: 10 });
    assert.equal(await cache.get(request('Hello')), undefined);
  });

  it('hits on a stored request', async () => {
    const cache = createMemoryTranslationCache({ maxEntries: 10 });
    await cache.set(request('Hello'), result('Hallo'));
    const hit = await cache.get(request('Hello'));
    assert.equal(hit?.translatedText, 'Hallo');
  });

  it('keys on the language pair, not just the text', async () => {
    const cache = createMemoryTranslationCache({ maxEntries: 10 });
    await cache.set(request('Hello', 'de'), result('Hallo'));
    assert.equal(await cache.get(request('Hello', 'fr')), undefined);
  });

  it('overwrites rather than duplicating the same key', async () => {
    const cache = createMemoryTranslationCache({ maxEntries: 10 });
    await cache.set(request('Hello'), result('first'));
    await cache.set(request('Hello'), result('second'));
    assert.equal((await cache.get(request('Hello')))?.translatedText, 'second');
  });

  it('evicts the least recently used entry past the limit', async () => {
    const cache = createMemoryTranslationCache({ maxEntries: 2 });
    await cache.set(request('one'), result('1'));
    await cache.set(request('two'), result('2'));

    // Touch "one" so "two" becomes the least recently used.
    await cache.get(request('one'));
    await cache.set(request('three'), result('3'));

    assert.ok(await cache.get(request('one')), 'recently used entry survives');
    assert.equal(await cache.get(request('two')), undefined, 'LRU entry evicted');
    assert.ok(await cache.get(request('three')));
  });

  it('clears everything', async () => {
    const cache = createMemoryTranslationCache({ maxEntries: 10 });
    await cache.set(request('Hello'), result('Hallo'));
    await cache.clear();
    assert.equal(await cache.get(request('Hello')), undefined);
  });
});

describe('null translation cache', () => {
  it('never stores anything', async () => {
    const cache = createNullTranslationCache();
    await cache.set(request('Hello'), result('Hallo'));
    assert.equal(await cache.get(request('Hello')), undefined);
  });
});

describe('in-flight registry', () => {
  it('shares one operation between concurrent identical calls', async () => {
    const registry = createInFlightRegistry();
    let calls = 0;

    const operation = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'value';
    };

    const [a, b, c] = await Promise.all([
      registry.run('key', operation),
      registry.run('key', operation),
      registry.run('key', operation),
    ]);

    assert.equal(calls, 1, 'only one call should have run');
    assert.deepEqual([a, b, c], ['value', 'value', 'value']);
  });

  it('keeps different keys independent', async () => {
    const registry = createInFlightRegistry();
    let calls = 0;
    const operation = async () => {
      calls += 1;
      return calls;
    };

    await Promise.all([registry.run('a', operation), registry.run('b', operation)]);
    assert.equal(calls, 2);
  });

  it('releases the slot once settled, so it is not a cache', async () => {
    const registry = createInFlightRegistry();
    let calls = 0;
    const operation = async () => {
      calls += 1;
      return calls;
    };

    await registry.run('key', operation);
    assert.equal(registry.size, 0, 'slot released');
    await registry.run('key', operation);
    assert.equal(calls, 2, 'second sequential call runs again');
  });

  it('releases the slot when the operation rejects', async () => {
    const registry = createInFlightRegistry();
    await assert.rejects(() => registry.run('key', async () => Promise.reject(new Error('boom'))));
    assert.equal(registry.size, 0);
  });
});
