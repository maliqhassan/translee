import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { mockTranslationService } from '@/services/translation/mock-translation-service';
import {
  createMlKitOfflineEngine,
  type MlKitNative,
} from '@/services/translation/offline/mlkit/mlkit-offline-engine';
import { createOfflineTranslationService } from '@/services/translation/offline-translation-service';
import { orderEngines } from '@/services/translation/routing-policy';
import { createTranslationRouter } from '@/services/translation/translation-router';
import type { TranslationService } from '@/services/translation/translation-service';
import type { TranslationMode, TranslationRequest } from '@/types';
import { appError, err, ok } from '@/utils';

/**
 * Day 16: the sample engine can no longer answer for a real one.
 *
 * The defect had two halves, and both are pinned here. The registry replaced
 * the whole candidate list with the sample engine whenever no backend URL was
 * configured, so the on-device engine was never asked; and the routing policy
 * exempted the sample engine from mode filtering, so it could satisfy
 * "on-device only" even with real models installed.
 *
 * The scenario that matters most is the sample engine present *alongside* the
 * real ones. Tests that pass it alone cannot tell "correctly refused" from
 * "there was nothing else anyway".
 */

const request: TranslationRequest = {
  text: 'Hello',
  sourceLanguage: 'en',
  targetLanguage: 'de',
  origin: 'text',
};

function fakeNative(downloaded: string[] = []): MlKitNative {
  const installed = new Set(downloaded);
  return {
    getSupportedLanguages: () => [],
    async getDownloadedLanguages() {
      return [...installed];
    },
    async downloadModel(language: string) {
      installed.add(language);
    },
    async deleteModel(language: string) {
      installed.delete(language);
    },
    async translate(_source: string, target: string, text: string) {
      return `[${target}] ${text}`;
    },
    async closeAll() {},
  };
}

/** A backend-backed engine that works, for the online-mode cases. */
const workingOnline: TranslationService = {
  id: 'test.online',
  engine: 'online',
  isAvailable: async () => true,
  supportsPair: async () => true,
  translate: async () =>
    ok({
      id: 'online-1',
      sourceText: 'Hello',
      translatedText: 'from-online',
      sourceLanguage: 'en',
      targetLanguage: 'de',
      engine: 'online' as const,
      origin: 'text' as const,
      createdAt: 0,
    }),
  detectLanguage: async () => ok({ code: 'en', confidence: 1 }),
};

/** What `unconfiguredOnlineTranslationService` behaves like: present, unusable. */
const unconfiguredOnline: TranslationService = {
  id: 'test.online.unconfigured',
  engine: 'online',
  isAvailable: async () => false,
  supportsPair: async () => true,
  translate: async () => err(appError('service_unavailable', 'No backend is configured.')),
  detectLanguage: async () => err(appError('service_unavailable', 'No backend is configured.')),
};

const offlineWith = (downloaded: string[]) =>
  createOfflineTranslationService(createMlKitOfflineEngine({ native: fakeNative(downloaded) }));

/** The registry's real shape once the sample engine is explicitly enabled. */
const routerWith = (
  engines: readonly TranslationService[],
  mode: TranslationMode,
  network: 'online' | 'offline' = 'online',
) =>
  createTranslationRouter({
    engines,
    mode: () => mode,
    network: {
      id: 'test.network',
      isAvailable: async () => true,
      getStatus: async () => network,
      subscribe: () => () => {},
    },
  });

describe('on-device mode reaches the on-device engine', () => {
  it('selects the offline engine when both models are present', async () => {
    const result = await routerWith(
      [unconfiguredOnline, offlineWith(['en', 'de']), mockTranslationService],
      'offline',
    ).translate(request);

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.engine, 'offline');
    assert.equal(result.ok && result.value.translatedText, '[de] Hello');
  });

  it('returns model_missing when the models are absent', async () => {
    const result = await routerWith(
      [unconfiguredOnline, offlineWith([]), mockTranslationService],
      'offline',
    ).translate(request);

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, 'model_missing');
  });

  it('never falls back to a working online engine', async () => {
    const result = await routerWith([workingOnline, offlineWith([])], 'offline').translate(request);

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, 'model_missing');
  });

  it('never falls back to the sample engine, even when it is enabled', async () => {
    // The heart of the Day 16 defect: the sample engine was exempt from mode
    // filtering, so this returned "Hallo" badged Sample.
    const result = await routerWith(
      [workingOnline, offlineWith([]), mockTranslationService],
      'offline',
    ).translate(request);

    // Checked before the narrowing assertion below, so this genuinely reads
    // the result rather than a type-narrowed `never`.
    assert.equal(result.ok && result.value.engine === 'mock', false, 'no sample result here');
    assert.equal(result.ok, false);
  });

  it('is unaffected by there being no backend configured', async () => {
    // A missing EXPO_PUBLIC_TRANSEE_API_URL used to remove the offline engine
    // from the list entirely. Here the online engine is unusable and the
    // offline engine still answers.
    const result = await routerWith(
      [unconfiguredOnline, offlineWith(['en', 'de'])],
      'offline',
    ).translate(request);

    assert.equal(result.ok && result.value.engine, 'offline');
  });
});

describe('online mode stays online or fails honestly', () => {
  it('uses the online engine when it is configured', async () => {
    const result = await routerWith(
      [workingOnline, offlineWith(['en', 'de']), mockTranslationService],
      'online',
    ).translate(request);

    assert.equal(result.ok && result.value.engine, 'online');
  });

  it('does not become a sample translation when the backend is unconfigured', async () => {
    const result = await routerWith(
      [unconfiguredOnline, offlineWith(['en', 'de']), mockTranslationService],
      'online',
    ).translate(request);

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, 'service_unavailable');
  });

  it('does not quietly use the on-device engine either', async () => {
    const result = await routerWith(
      [unconfiguredOnline, offlineWith(['en', 'de'])],
      'online',
    ).translate(request);

    assert.equal(result.ok && result.value.engine === 'offline', false);
  });
});

describe('auto mode keeps the existing policy', () => {
  it('prefers the online engine when connected', async () => {
    const result = await routerWith(
      [workingOnline, offlineWith(['en', 'de'])],
      'auto',
      'online',
    ).translate(request);

    assert.equal(result.ok && result.value.engine, 'online');
  });

  it('prefers the on-device engine when there is no connection', async () => {
    const result = await routerWith(
      [workingOnline, offlineWith(['en', 'de'])],
      'auto',
      'offline',
    ).translate(request);

    assert.equal(result.ok && result.value.engine, 'offline');
  });

  it('still ranks the sample engine behind both real engines', () => {
    const ordered = orderEngines([mockTranslationService, workingOnline, offlineWith([])], {
      network: 'online',
      mode: 'auto',
    });

    assert.equal(ordered[ordered.length - 1]?.engine, 'mock');
  });

  it('reaches the sample engine only once no real engine can serve', async () => {
    const result = await routerWith(
      [unconfiguredOnline, offlineWith([]), mockTranslationService],
      'auto',
    ).translate(request);

    // Auto expresses no preference, so a clearly badged stand-in is acceptable
    // here and only here.
    assert.equal(result.ok && result.value.engine, 'mock');
  });
});

describe('the sample engine is opt-in only', () => {
  it('is admitted by the feature flag and nothing else', () => {
    const registry = readFileSync('src/services/service-registry.ts', 'utf8');

    // Both real engines are unconditional members of the candidate list.
    assert.match(registry, /const translationEngines[\s\S]{0,200}onlineTranslationService,/);
    assert.match(registry, /const translationEngines[\s\S]{0,200}offlineEngine,/);
    // The sample engine appears only behind the flag.
    assert.match(registry, /FEATURES\.mockTranslation \? \[mockTranslationService\] : \[\]/);
    // And the old backend-driven swap is gone.
    assert.equal(registry.includes('useSampleEngine'), false);
    assert.equal(registry.includes('hasBackendConfigured'), false);
  });

  it('is no longer exempt from mode filtering in the policy', () => {
    const policy = readFileSync('src/services/translation/routing-policy.ts', 'utf8');
    assert.equal(policy.includes("engine === 'mock' || mode === 'auto'"), false);
  });

  it('cannot satisfy any mode the user actually chose', async () => {
    for (const mode of ['online', 'offline'] as TranslationMode[]) {
      const result = await routerWith([mockTranslationService], mode).translate(request);
      assert.equal(result.ok, false, `${mode} must not be served by the sample engine`);
    }
  });

  it('is still available for development in auto mode', async () => {
    // Day 16 demotes the sample engine; it does not delete it.
    const result = await routerWith([mockTranslationService], 'auto').translate(request);

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.engine, 'mock');
  });
});
