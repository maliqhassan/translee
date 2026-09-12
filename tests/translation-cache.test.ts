import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { withCache } from '@/services/translation/caching-router';
import { createInFlightRegistry } from '@/services/translation/in-flight-requests';
import {
  createMemoryTranslationCache,
  createNullTranslationCache,
} from '@/services/translation/translation-cache';
import type { NormalizedTranslationRequest } from '@/services/translation/translation-request';
import type { TranslationResult } from '@/types';
import { appError, err, ok } from '@/utils';

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

/**
 * Step 2C: the cache sits above the router, so it is a bypass of its own.
 *
 * An on-device translation earned under Pro would otherwise keep being handed
 * back after the plan lapsed, without the routing policy ever being consulted.
 */
describe('cached on-device results respect the entitlement', () => {
  const offlineResult = (text: string): TranslationResult => ({
    ...result(text),
    engine: 'offline',
  });

  const onlineResult = (text: string): TranslationResult => ({
    ...result(text),
    engine: 'online',
  });

  /** A router that records what reached it and answers with a fresh result. */
  function countingRouter(answer: TranslationResult) {
    let calls = 0;
    return {
      calls: () => calls,
      router: {
        async translate() {
          calls += 1;
          return ok(answer);
        },
        async resolveEngine() {
          return answer.engine;
        },
      },
    };
  }

  it('serves a cached on-device result while still entitled', async () => {
    const cache = createMemoryTranslationCache({ maxEntries: 8 });
    await cache.set(request('Hello'), offlineResult('Hallo'));

    const { router, calls } = countingRouter(onlineResult('from-router'));
    const cached = withCache(router, { cache, offlineEntitled: () => true });

    const got = await cached.translate({ ...request('Hello'), origin: 'text' });

    assert.equal(got.ok && got.value.translatedText, 'Hallo');
    assert.equal(calls(), 0, 'the cache answered');
  });

  it('refuses a cached on-device result after the entitlement is lost', async () => {
    const cache = createMemoryTranslationCache({ maxEntries: 8 });
    // Earned while Pro.
    await cache.set(request('Hello'), offlineResult('Hallo'));

    const { router, calls } = countingRouter(onlineResult('from-router'));
    const cached = withCache(router, { cache, offlineEntitled: () => false });

    const got = await cached.translate({ ...request('Hello'), origin: 'text' });

    assert.equal(got.ok && got.value.translatedText, 'from-router');
    assert.notEqual(got.ok && got.value.engine, 'offline');
    assert.equal(calls(), 1, 'the request fell through to the router, which gates properly');
  });

  it('still serves the online entries sitting beside it', async () => {
    const cache = createMemoryTranslationCache({ maxEntries: 8 });
    await cache.set(request('Hello'), onlineResult('Hallo'));

    const { router, calls } = countingRouter(onlineResult('from-router'));
    const cached = withCache(router, { cache, offlineEntitled: () => false });

    const got = await cached.translate({ ...request('Hello'), origin: 'text' });

    assert.equal(got.ok && got.value.translatedText, 'Hallo');
    assert.equal(calls(), 0, 'only on-device entries are in question');
  });

  it('leaves the refused entry in place rather than evicting it', async () => {
    // The realistic shape of a refusal today: nothing else can serve the pair,
    // so the router fails and there is no new result to store. The stored
    // on-device entry must survive that, because resubscribing should get the
    // cache back rather than a cache someone purged on the way past.
    const cache = createMemoryTranslationCache({ maxEntries: 8 });
    await cache.set(request('Hello'), offlineResult('Hallo'));

    let entitled = false;
    const failing = {
      async translate() {
        return err(appError('service_unavailable', 'nothing can serve this'));
      },
      async resolveEngine() {
        return 'online' as const;
      },
    };
    const cached = withCache(failing, { cache, offlineEntitled: () => entitled });

    const refused = await cached.translate({ ...request('Hello'), origin: 'text' });
    assert.equal(refused.ok, false, 'the free user gets an error, not the cached translation');

    entitled = true;
    const stored = await cache.get(request('Hello'));
    assert.equal(stored?.translatedText, 'Hallo', 'nothing was thrown away');
  });

  it('replaces the refused entry when a new result does arrive', async () => {
    // A successful re-translation is cached as normal, so the stale on-device
    // entry is superseded rather than lingering behind a newer answer.
    const cache = createMemoryTranslationCache({ maxEntries: 8 });
    await cache.set(request('Hello'), offlineResult('Hallo'));

    const { router } = countingRouter(onlineResult('from-router'));
    const cached = withCache(router, { cache, offlineEntitled: () => false });

    await cached.translate({ ...request('Hello'), origin: 'text' });

    const stored = await cache.get(request('Hello'));
    assert.equal(stored?.translatedText, 'from-router');
    assert.equal(stored?.engine, 'online');
  });

  it('asks on every read, so a plan change lands on the next request', async () => {
    const cache = createMemoryTranslationCache({ maxEntries: 8 });
    await cache.set(request('Hello'), offlineResult('Hallo'));

    let entitled = true;
    const { router } = countingRouter(onlineResult('from-router'));
    const cached = withCache(router, { cache, offlineEntitled: () => entitled });

    const first = await cached.translate({ ...request('Hello'), origin: 'text' });
    assert.equal(first.ok && first.value.translatedText, 'Hallo');

    entitled = false;

    const second = await cached.translate({ ...request('Hello'), origin: 'text' });
    assert.equal(second.ok && second.value.translatedText, 'from-router');
  });

  it('behaves exactly as before when no getter is supplied', async () => {
    const cache = createMemoryTranslationCache({ maxEntries: 8 });
    await cache.set(request('Hello'), offlineResult('Hallo'));

    const { router, calls } = countingRouter(onlineResult('from-router'));
    const cached = withCache(router, { cache });

    const got = await cached.translate({ ...request('Hello'), origin: 'text' });

    assert.equal(got.ok && got.value.translatedText, 'Hallo');
    assert.equal(calls(), 0);
  });
});
