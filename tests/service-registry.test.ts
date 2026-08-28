import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TRANSLATION_CONFIG, hasBackendConfigured } from '@/constants/translation-config';
import { services } from '@/services/service-registry';
import type { TranslationRequest } from '@/types';

/**
 * Exercises the real wiring, not a rebuilt copy of it: this is the object the
 * screens actually call.
 */

const request: TranslationRequest = {
  text: 'Hello',
  sourceLanguage: 'en',
  targetLanguage: 'de',
  origin: 'text',
};

describe('service registry', () => {
  it('keeps the Day 2 mock experience working through the real router', async () => {
    const result = await services.translation.router.translate(request);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.translatedText, 'Hallo');
    assert.equal(result.value.engine, 'mock');
  });

  it('serves a repeat request from the cache', async () => {
    const unique = `Hello ${Date.now()}`;
    const first = await services.translation.router.translate({ ...request, text: unique });
    const second = await services.translation.router.translate({ ...request, text: unique });

    assert.equal(first.ok && second.ok, true);
    // Same stored object, so the ids match: proof it came from the cache.
    assert.equal(first.ok && second.ok && first.value.id, second.ok ? second.value.id : '');
  });

  it('rejects invalid input before reaching an engine', async () => {
    const result = await services.translation.router.translate({ ...request, text: '  ' });
    assert.equal(!result.ok && result.error.code, 'invalid_request');
  });

  it('reports the engine the UI would badge', async () => {
    assert.equal(await services.translation.router.resolveEngine(request), 'mock');
  });

  it('ships with no backend configured, so nothing calls a missing URL', async () => {
    assert.equal(hasBackendConfigured(), false);
    assert.equal(TRANSLATION_CONFIG.backend.baseUrl, undefined);
    assert.equal(await services.translation.online.isAvailable(), false);
  });

  it('carries no provider credential in client configuration', () => {
    const serialised = JSON.stringify(TRANSLATION_CONFIG).toLowerCase();
    for (const forbidden of ['apikey', 'api_key', 'secret', 'token', 'password', 'authorization']) {
      assert.ok(!serialised.includes(forbidden), `config must not contain "${forbidden}"`);
    }
  });

  it('exposes a cache that can be cleared', async () => {
    await services.translation.cache.clear();
    const fresh = await services.translation.cache.get({
      text: 'Hello',
      sourceLanguage: 'en',
      targetLanguage: 'de',
      origin: 'text',
    });
    assert.equal(fresh, undefined);
  });

  it('exposes connectivity as a service', async () => {
    const status = await services.network.getStatus();
    assert.ok(['online', 'offline', 'unknown'].includes(status));
  });
});
