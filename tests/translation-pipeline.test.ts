import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { HttpClient, HttpResponse } from '@/services/http/http-client';
import type { NetworkService, NetworkStatus } from '@/services/network/network-service';
import { withCache } from '@/services/translation/caching-router';
import { mockTranslationService } from '@/services/translation/mock-translation-service';
import { createOnlineTranslationService } from '@/services/translation/online-translation-service';
import { backendAdapter } from '@/services/translation/provider/backend-adapter';
import { createBackendTranslationProvider } from '@/services/translation/provider/backend-translation-provider';
import { orderEngines } from '@/services/translation/routing-policy';
import { createMemoryTranslationCache } from '@/services/translation/translation-cache';
import { createTranslationRouter } from '@/services/translation/translation-router';
import type { TranslationService } from '@/services/translation/translation-service';
import type { TranslationRequest } from '@/types';
import { ok } from '@/utils';

const retry = { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 };
const noSleep = async () => {};

const request: TranslationRequest = {
  text: 'Hello',
  sourceLanguage: 'en',
  targetLanguage: 'de',
  origin: 'text',
};

const networkOf = (status: NetworkStatus): NetworkService => ({
  id: 'network.test',
  isAvailable: async () => true,
  getStatus: async () => status,
  subscribe: () => () => {},
});

/** An HttpClient that replays a scripted sequence of responses. */
function scriptedHttp(responses: HttpResponse[]): { http: HttpClient; calls: () => number } {
  let index = 0;
  return {
    http: {
      async send() {
        const response = responses[Math.min(index, responses.length - 1)];
        index += 1;
        return ok(response as HttpResponse);
      },
    },
    calls: () => index,
  };
}

const jsonResponse = (data: unknown, status = 200): HttpResponse => ({
  status,
  ok: status >= 200 && status < 300,
  data,
});

function onlineServiceWith(responses: HttpResponse[], status: NetworkStatus = 'online') {
  const { http, calls } = scriptedHttp(responses);
  const provider = createBackendTranslationProvider({
    baseUrl: 'https://api.example.test',
    translatePath: '/translation',
    http,
  });
  return {
    service: createOnlineTranslationService({
      provider,
      network: networkOf(status),
      retry,
      sleep: noSleep,
    }),
    calls,
  };
}

describe('backend adapter response validation', () => {
  it('accepts a well-formed payload', () => {
    const result = backendAdapter.toTranslation({ translatedText: 'Hallo' });
    assert.equal(result.ok && result.value.translatedText, 'Hallo');
  });

  it('keeps a resolvable detected language', () => {
    const result = backendAdapter.toTranslation({
      translatedText: 'Hallo',
      detectedLanguage: 'en',
    });
    assert.equal(result.ok && result.value.detectedLanguage, 'en');
  });

  it('drops a detected language that is not in the catalogue', () => {
    const result = backendAdapter.toTranslation({
      translatedText: 'Hallo',
      detectedLanguage: 'not-real',
    });
    assert.equal(result.ok && result.value.detectedLanguage, undefined);
  });

  it('rejects malformed payloads', () => {
    const malformed: unknown[] = [
      null,
      'a string',
      42,
      [],
      {},
      { translatedText: 123 },
      { translatedText: '' },
      { translatedText: 'Hallo', detectedLanguage: 7 },
    ];
    for (const payload of malformed) {
      const result = backendAdapter.toTranslation(payload);
      assert.equal(result.ok, false, `should reject ${JSON.stringify(payload)}`);
      assert.equal(!result.ok && result.error.code, 'invalid_response');
    }
  });
});

describe('online translation service', () => {
  it('normalises a successful response into a TranslationResult', async () => {
    const { service } = onlineServiceWith([jsonResponse({ translatedText: 'Hallo' })]);
    const result = await service.translate(request);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.translatedText, 'Hallo');
    assert.equal(result.value.sourceText, 'Hello');
    assert.equal(result.value.engine, 'online');
    assert.equal(result.value.sourceLanguage, 'en');
    assert.equal(result.value.targetLanguage, 'de');
    assert.ok(result.value.id.length > 0);
    assert.ok(result.value.createdAt > 0);
  });

  it('rejects invalid input before touching the network', async () => {
    const { service, calls } = onlineServiceWith([jsonResponse({ translatedText: 'Hallo' })]);
    const result = await service.translate({ ...request, text: '   ' });
    assert.equal(!result.ok && result.error.code, 'invalid_request');
    assert.equal(calls(), 0, 'no request should have been sent');
  });

  it('turns a malformed body into invalid_response without retrying', async () => {
    const { service, calls } = onlineServiceWith([jsonResponse({ wrong: 'shape' })]);
    const result = await service.translate(request);
    assert.equal(!result.ok && result.error.code, 'invalid_response');
    assert.equal(calls(), 1, 'a malformed body is not transient');
  });

  it('retries a 5xx and succeeds on a later attempt', async () => {
    const { service, calls } = onlineServiceWith([
      jsonResponse({}, 503),
      jsonResponse({ translatedText: 'Hallo' }),
    ]);
    const result = await service.translate(request);
    assert.equal(result.ok && result.value.translatedText, 'Hallo');
    assert.equal(calls(), 2);
  });

  it('does not retry a 4xx', async () => {
    const { service, calls } = onlineServiceWith([jsonResponse({}, 400)]);
    const result = await service.translate(request);
    assert.equal(!result.ok && result.error.code, 'invalid_request');
    assert.equal(calls(), 1);
  });

  it('reports unavailable when the device is offline', async () => {
    const { service } = onlineServiceWith([jsonResponse({ translatedText: 'Hallo' })], 'offline');
    assert.equal(await service.isAvailable(), false);
  });

  it('is available when connectivity is unknown, rather than refusing to try', async () => {
    const { service } = onlineServiceWith([jsonResponse({ translatedText: 'Hallo' })], 'unknown');
    assert.equal(await service.isAvailable(), true);
  });

  it('is unavailable when no backend is configured', async () => {
    const provider = createBackendTranslationProvider({
      baseUrl: undefined,
      translatePath: '/translation',
      http: {
        async send() {
          return ok(jsonResponse({}));
        },
      },
    });
    assert.equal(provider.isConfigured(), false);
    const service = createOnlineTranslationService({
      provider,
      network: networkOf('online'),
      retry,
      sleep: noSleep,
    });
    assert.equal(await service.isAvailable(), false);
  });
});

describe('routing policy', () => {
  const engineOf = (engine: TranslationService['engine']): TranslationService => ({
    id: `test.${engine}`,
    engine,
    isAvailable: async () => true,
    supportsPair: async () => true,
    translate: async () =>
      ok({ ...request, id: 'x', sourceText: 'Hello', translatedText: 'x', engine, createdAt: 0 }),
    detectLanguage: async () => ok({ code: 'en', confidence: 1 }),
  });

  const online = engineOf('online');
  const offline = engineOf('offline');
  const mock = engineOf('mock');

  it('prefers online when connected', () => {
    const ordered = orderEngines([offline, online], { network: 'online' });
    assert.equal(ordered[0]?.engine, 'online');
  });

  it('prefers offline when disconnected', () => {
    const ordered = orderEngines([online, offline], { network: 'offline' });
    assert.equal(ordered[0]?.engine, 'offline');
  });

  it('prefers offline when the user asked for it', () => {
    const ordered = orderEngines([online, offline], { network: 'online', preferOffline: true });
    assert.equal(ordered[0]?.engine, 'offline');
  });

  it('treats unknown connectivity as online', () => {
    const ordered = orderEngines([offline, online], { network: 'unknown' });
    assert.equal(ordered[0]?.engine, 'online');
  });

  it('never drops a candidate, only reorders', () => {
    const ordered = orderEngines([online, offline, mock], { network: 'offline' });
    assert.equal(ordered.length, 3);
  });

  it('ranks the sample engine last', () => {
    const ordered = orderEngines([mock, online], { network: 'online' });
    assert.equal(ordered[1]?.engine, 'mock');
  });
});

describe('translation router', () => {
  it('still serves the Day 2 mock experience', async () => {
    const router = createTranslationRouter({ engines: [mockTranslationService] });
    const result = await router.translate(request);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.translatedText, 'Hallo');
    assert.equal(result.value.engine, 'mock');
  });

  it('resolves the engine it would use', async () => {
    const router = createTranslationRouter({ engines: [mockTranslationService] });
    assert.equal(await router.resolveEngine(request), 'mock');
  });

  it('rejects invalid input before selecting an engine', async () => {
    const router = createTranslationRouter({ engines: [mockTranslationService] });
    const result = await router.translate({ ...request, text: '' });
    assert.equal(!result.ok && result.error.code, 'invalid_request');
  });

  it('reports a friendly offline failure when nothing can serve the pair', async () => {
    const unusable: TranslationService = {
      ...mockTranslationService,
      isAvailable: async () => false,
    };
    const router = createTranslationRouter({
      engines: [unusable],
      network: networkOf('offline'),
    });
    const result = await router.translate(request);
    assert.equal(!result.ok && result.error.code, 'network_unavailable');
  });

  it('reports an unsupported pair when online but no engine matches', async () => {
    const router = createTranslationRouter({
      engines: [mockTranslationService],
      network: networkOf('online'),
    });
    // Swahili is outside the sample engine's data.
    const result = await router.translate({ ...request, targetLanguage: 'sw' });
    assert.equal(!result.ok && result.error.code, 'unsupported_language');
  });
});

describe('caching router', () => {
  function countingRouter() {
    let calls = 0;
    const router = createTranslationRouter({ engines: [mockTranslationService] });
    return {
      calls: () => calls,
      router: {
        translate: (r: TranslationRequest) => {
          calls += 1;
          return router.translate(r);
        },
        resolveEngine: (r: TranslationRequest) => router.resolveEngine(r),
      },
    };
  }

  it('misses then hits', async () => {
    const { router, calls } = countingRouter();
    const cached = withCache(router, {
      cache: createMemoryTranslationCache({ maxEntries: 10 }),
    });

    const first = await cached.translate(request);
    const second = await cached.translate(request);

    assert.equal(first.ok && second.ok, true);
    assert.equal(calls(), 1, 'second call served from cache');
    assert.equal(
      first.ok && second.ok && first.value.translatedText,
      second.ok ? second.value.translatedText : '',
    );
  });

  it('treats a different pair as a miss', async () => {
    const { router, calls } = countingRouter();
    const cached = withCache(router, { cache: createMemoryTranslationCache({ maxEntries: 10 }) });

    await cached.translate(request);
    await cached.translate({ ...request, targetLanguage: 'fr' });
    assert.equal(calls(), 2);
  });

  it('ignores whitespace differences, because normalisation runs first', async () => {
    const { router, calls } = countingRouter();
    const cached = withCache(router, { cache: createMemoryTranslationCache({ maxEntries: 10 }) });

    await cached.translate(request);
    await cached.translate({ ...request, text: '  Hello  ' });
    assert.equal(calls(), 1);
  });

  it('does not cache failures', async () => {
    const { router, calls } = countingRouter();
    const cached = withCache(router, { cache: createMemoryTranslationCache({ maxEntries: 10 }) });

    const unsupported = { ...request, targetLanguage: 'sw' };
    await cached.translate(unsupported);
    await cached.translate(unsupported);
    assert.equal(calls(), 2, 'a failure must not be remembered');
  });

  it('passes invalid requests through to the router', async () => {
    const { router } = countingRouter();
    const cached = withCache(router, { cache: createMemoryTranslationCache({ maxEntries: 10 }) });
    const result = await cached.translate({ ...request, text: '' });
    assert.equal(!result.ok && result.error.code, 'invalid_request');
  });
});
