import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { NetworkService, NetworkStatus } from '@/services/network/network-service';
import { mockTranslationService } from '@/services/translation/mock-translation-service';
import { orderEngines } from '@/services/translation/routing-policy';
import { createTranslationRouter } from '@/services/translation/translation-router';
import type { TranslationService } from '@/services/translation/translation-service';
import type { TranslationMode, TranslationRequest } from '@/types';
import { ok } from '@/utils';

/** Day 7: the translation-mode preference reaching the routing policy. */

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

function engineOf(engine: TranslationService['engine'], available = true): TranslationService {
  return {
    id: `test.${engine}`,
    engine,
    isAvailable: async () => available,
    supportsPair: async () => true,
    translate: async () =>
      ok({
        ...request,
        id: `id-${engine}`,
        sourceText: 'Hello',
        translatedText: `from-${engine}`,
        engine,
        createdAt: 0,
      }),
    detectLanguage: async () => ok({ code: 'en', confidence: 1 }),
  };
}

const online = engineOf('online');
const offline = engineOf('offline');
const mock = engineOf('mock');
const kinds = (list: readonly TranslationService[]) => list.map((engine) => engine.engine);

describe('translation mode shapes the candidate list', () => {
  it('auto allows every engine', () => {
    const ordered = orderEngines([online, offline, mock], { network: 'online', mode: 'auto' });
    assert.equal(ordered.length, 3);
  });

  it('online only excludes the offline engine', () => {
    const ordered = orderEngines([online, offline], { network: 'online', mode: 'online' });
    assert.deepEqual(kinds(ordered), ['online']);
  });

  it('on-device only excludes the online engine', () => {
    const ordered = orderEngines([online, offline], { network: 'online', mode: 'offline' });
    assert.deepEqual(kinds(ordered), ['offline']);
  });

  it('keeps the sample engine in every mode, since it stands in for what is missing', () => {
    for (const mode of ['auto', 'online', 'offline'] as TranslationMode[]) {
      assert.ok(
        kinds(orderEngines([mock], { network: 'online', mode })).includes('mock'),
        `mode ${mode}`,
      );
    }
  });

  it('still ranks by connectivity within the allowed set', () => {
    assert.equal(kinds(orderEngines([offline, online], { network: 'online' }))[0], 'online');
    assert.equal(kinds(orderEngines([online, offline], { network: 'offline' }))[0], 'offline');
  });

  it('treats the Day 4 preferOffline flag as the offline mode', () => {
    const ordered = orderEngines([online, offline], { network: 'online', preferOffline: true });
    assert.equal(kinds(ordered)[0], 'offline');
  });

  it('does not mutate the caller list', () => {
    const engines = [online, offline];
    orderEngines(engines, { network: 'offline', mode: 'auto' });
    assert.deepEqual(kinds(engines), ['online', 'offline']);
  });
});

describe('the router honours the mode', () => {
  const routerWith = (
    engines: readonly TranslationService[],
    mode: TranslationMode,
    network: NetworkStatus = 'online',
  ) => createTranslationRouter({ engines, network: networkOf(network), mode: () => mode });

  it('routes online when the user chose online', async () => {
    const result = await routerWith([online, offline], 'online').translate(request);
    assert.equal(result.ok && result.value.engine, 'online');
  });

  it('never silently uses the network when the user chose on-device', async () => {
    // The real offline engine is still a placeholder that reports itself
    // unavailable, so this must fail rather than quietly using the online one.
    const result = await routerWith([online, engineOf('offline', false)], 'offline').translate(
      request,
    );
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, 'model_missing');
  });

  it('says plainly that no language pack is installed', async () => {
    const unavailableOffline = engineOf('offline', false);
    const result = await routerWith([online, unavailableOffline], 'offline').translate(request);
    assert.equal(!result.ok && result.error.code, 'model_missing');
  });

  it('reports no connection when online is chosen and there is none', async () => {
    const result = await routerWith([engineOf('online', false)], 'online', 'offline').translate(
      request,
    );
    assert.equal(!result.ok && result.error.code, 'network_unavailable');
  });

  it('falls back across engines in auto mode', async () => {
    const result = await routerWith([engineOf('online', false), offline], 'auto').translate(
      request,
    );
    assert.equal(result.ok && result.value.engine, 'offline');
  });

  it('defaults to auto when no mode is supplied', async () => {
    const router = createTranslationRouter({ engines: [online, offline] });
    const result = await router.translate(request);
    assert.equal(result.ok, true);
  });

  it('keeps the sample engine working in every mode', async () => {
    for (const mode of ['auto', 'online', 'offline'] as TranslationMode[]) {
      const router = createTranslationRouter({
        engines: [mockTranslationService],
        mode: () => mode,
      });
      const result = await router.translate(request);
      assert.equal(result.ok, true, `mode ${mode} should still translate`);
      assert.equal(result.ok && result.value.translatedText, 'Hallo');
    }
  });

  it('reads the mode per request, so a settings change applies immediately', async () => {
    let mode: TranslationMode = 'online';
    const router = createTranslationRouter({
      // Offline is unavailable, as the placeholder engine is today.
      engines: [online, engineOf('offline', false)],
      network: networkOf('online'),
      mode: () => mode,
    });

    assert.equal((await router.translate(request)).ok, true);

    mode = 'offline';
    const afterChange = await router.translate(request);
    assert.equal(afterChange.ok, false, 'the new mode applies without rebuilding the router');
  });
});
