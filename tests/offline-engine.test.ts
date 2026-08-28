import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGES } from '@/constants';
import { createFileModelStorage } from '@/services/language-packs/file-model-storage';
import { toModelFilename, type ModelStorage } from '@/services/language-packs/model-storage';
import { mockTranslationService } from '@/services/translation/mock-translation-service';
import {
  canTransition,
  isBusy,
  isInstalled,
  isUsable,
  nextStatus,
} from '@/services/translation/offline/model-lifecycle';
import {
  createModelRegistry,
  offlineModelId,
  type RuntimeCapability,
} from '@/services/translation/offline/model-registry';
import { createModelRuntimeManager } from '@/services/translation/offline/model-runtime-manager';
import type {
  OfflineModelStatus,
  OfflineTranslationEngine,
} from '@/services/translation/offline/offline-engine';
import { unavailableOfflineEngine } from '@/services/translation/offline/unavailable-engine';
import { createOfflineTranslationService } from '@/services/translation/offline-translation-service';
import { createTranslationRouter } from '@/services/translation/translation-router';
import type { TranslationService } from '@/services/translation/translation-service';
import type { TranslationMode, TranslationRequest } from '@/types';
import { appError, err, ok } from '@/utils';

/** Day 8: the offline engine seam, the model registry and the lifecycle. */

const request: TranslationRequest = {
  text: 'Hello',
  sourceLanguage: 'en',
  targetLanguage: 'de',
  origin: 'text',
};

const RUNTIME = 'test-runtime';
const capability: RuntimeCapability = {
  format: 'test-format',
  version: '1.0.0',
  languages: ['en', 'de', 'zh-Hans', 'zh-Hant', 'pt-BR'],
};

const registryOf = (initialStatus?: Record<string, OfflineModelStatus>) =>
  createModelRegistry({ runtimeId: RUNTIME, capability, initialStatus });

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  assert.equal(result.ok, true, `expected ok, got ${JSON.stringify(result)}`);
  if (!result.ok) throw new Error('unreachable');
  return result.value;
};

describe('model registry', () => {
  it('lists one model per supported language', async () => {
    const models = unwrap(await registryOf().list());
    assert.equal(models.length, capability.languages.length);
    assert.ok(models.every((model) => model.status === 'not_installed'));
    assert.ok(models.every((model) => model.format === 'test-format'));
  });

  it('namespaces model ids by runtime', async () => {
    const model = unwrap(await registryOf().forLanguage('de'));
    assert.equal(model.id, offlineModelId(RUNTIME, 'de'));
    assert.equal(model.id, 'test-runtime:de');
  });

  it('reports a known model', async () => {
    const model = unwrap(await registryOf().get('test-runtime:en'));
    assert.equal(model.language, 'en');
  });

  it('handles an unknown model safely', async () => {
    const result = await registryOf().get('test-runtime:nope');
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, 'model_missing');
  });

  it('handles an unsupported language safely', async () => {
    const result = await registryOf().forLanguage('sw');
    assert.equal(!result.ok && result.error.code, 'model_missing');
    assert.equal(registryOf().supportsLanguage('sw'), false);
  });

  it('refuses a language the catalogue does not know', async () => {
    // A runtime naming an unknown language is a mapping bug, not a discovery.
    const registry = createModelRegistry({
      runtimeId: RUNTIME,
      capability: { ...capability, languages: ['en', 'klingon'] },
    });
    const models = unwrap(await registry.list());
    assert.deepEqual(
      models.map((model) => model.language),
      ['en'],
    );
  });

  it('keeps language variants distinct', async () => {
    const registry = registryOf();
    const hans = unwrap(await registry.forLanguage('zh-Hans'));
    const hant = unwrap(await registry.forLanguage('zh-Hant'));

    assert.notEqual(hans.id, hant.id);
    assert.equal(hans.language, 'zh-Hans');
    assert.equal(hant.language, 'zh-Hant');
    assert.equal(registry.supportsLanguage('pt-BR'), true);
    // pt-PT was not offered by this runtime, and is not conjured from pt-BR.
    assert.equal(registry.supportsLanguage('pt-PT'), false);
  });

  it('reports no ready pairs until both sides are loaded', async () => {
    const registry = registryOf();
    assert.equal(unwrap(await registry.readyPairs()).length, 0);

    await registry.setStatus('test-runtime:en', 'ready');
    assert.equal(
      unwrap(await registry.isPairReady('en', 'de')),
      false,
      'one side loaded is not enough',
    );

    await registry.setStatus('test-runtime:de', 'ready');
    assert.equal(unwrap(await registry.isPairReady('en', 'de')), true);
    assert.equal(unwrap(await registry.isPairReady('de', 'en')), true);
  });

  it('never reports a same-language pair as ready', async () => {
    const registry = registryOf();
    await registry.setStatus('test-runtime:en', 'ready');
    assert.equal(unwrap(await registry.isPairReady('en', 'en')), false);
  });

  it('does not treat an installed-but-unloaded model as ready', async () => {
    const registry = registryOf();
    await registry.setStatus('test-runtime:en', 'installed');
    await registry.setStatus('test-runtime:de', 'installed');
    assert.equal(unwrap(await registry.isPairReady('en', 'de')), false);
  });

  it('records an install time only while installed', async () => {
    const registry = registryOf();
    const installed = unwrap(await registry.setStatus('test-runtime:en', 'installed'));
    assert.ok(installed.installedAt);

    const removed = unwrap(await registry.setStatus('test-runtime:en', 'not_installed'));
    assert.equal(removed.installedAt, undefined);
  });
});

describe('no language is falsely marked offline-capable', () => {
  it('the catalogue still claims no offline support', () => {
    assert.ok(
      LANGUAGES.every((language) => language.offline.supported === false),
      'no runtime is installed, so nothing may claim offline support',
    );
  });

  it('the shipped engine reports no languages and no pairs', async () => {
    assert.equal(unwrap(await unavailableOfflineEngine.getSupportedLanguages()).length, 0);
    assert.equal(unwrap(await unavailableOfflineEngine.getReadyPairs()).length, 0);
    assert.equal(unwrap(await unavailableOfflineEngine.listModels()).length, 0);
    assert.equal(unwrap(await unavailableOfflineEngine.isAvailable()), false);
  });

  it('the shipped engine refuses to translate or load', async () => {
    const translated = await unavailableOfflineEngine.translate(request);
    assert.equal(!translated.ok && translated.error.code, 'model_missing');

    const loaded = await unavailableOfflineEngine.loadModel('anything');
    assert.equal(!loaded.ok && loaded.error.code, 'model_missing');
  });
});

describe('model lifecycle', () => {
  it('walks the happy path', () => {
    const path: [OfflineModelStatus, OfflineModelStatus][] = [
      ['not_installed', 'downloading'],
      ['downloading', 'installed'],
      ['installed', 'loading'],
      ['loading', 'ready'],
      ['ready', 'unloading'],
      ['unloading', 'installed'],
    ];
    for (const [from, to] of path) {
      assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
    }
  });

  it('only ever reaches ready from loading', () => {
    const statuses: OfflineModelStatus[] = [
      'not_installed',
      'downloading',
      'installed',
      'ready',
      'unloading',
      'error',
    ];
    for (const from of statuses) {
      assert.equal(canTransition(from, 'ready'), false, `${from} must not reach ready`);
    }
    assert.equal(canTransition('loading', 'ready'), true);
  });

  it('never makes a failed download installed', () => {
    assert.equal(nextStatus('downloading', 'download_failed'), 'error');
    assert.notEqual(nextStatus('downloading', 'download_failed'), 'installed');
    assert.equal(isInstalled('error'), false);
    assert.equal(isUsable('error'), false);
  });

  it('never makes a failed load ready', () => {
    assert.equal(nextStatus('loading', 'load_failed'), 'error');
    assert.equal(isUsable(nextStatus('loading', 'load_failed') ?? 'error'), false);
  });

  it('returns a cancelled download to not_installed, not error', () => {
    assert.equal(nextStatus('downloading', 'download_cancelled'), 'not_installed');
  });

  it('ignores an event that does not apply, rather than corrupting state', () => {
    // A late callback from a download that was already cancelled.
    assert.equal(nextStatus('not_installed', 'download_finished'), undefined);
    assert.equal(nextStatus('ready', 'download_started'), undefined);
    assert.equal(nextStatus('installed', 'load_finished'), undefined);
  });

  it('recovers from error only through a clean state', () => {
    assert.equal(nextStatus('error', 'retry'), 'not_installed');
    assert.equal(canTransition('error', 'ready'), false);
    assert.equal(canTransition('error', 'loading'), false);
  });

  it('classifies statuses consistently', () => {
    assert.equal(isUsable('ready'), true);
    assert.deepEqual(
      (['installed', 'loading', 'ready', 'unloading'] as OfflineModelStatus[]).map(isInstalled),
      [true, true, true, true],
    );
    assert.equal(isInstalled('not_installed'), false);
    assert.equal(isInstalled('downloading'), false);
    assert.deepEqual(
      (['downloading', 'loading', 'unloading'] as OfflineModelStatus[]).map(isBusy),
      [true, true, true],
    );
    assert.equal(isBusy('ready'), false);
  });
});

describe('model runtime manager', () => {
  function loaderSpy(fail = false) {
    const loads: string[] = [];
    const unloads: string[] = [];
    return {
      loads,
      unloads,
      loader: {
        async load(modelId: string) {
          loads.push(modelId);
          await new Promise((resolve) => setTimeout(resolve, 5));
          return fail ? err(appError('model_missing', 'nope')) : ok(undefined);
        },
        async unload(modelId: string) {
          unloads.push(modelId);
          return ok(undefined);
        },
      },
    };
  }

  it('loads once and reuses the loaded model', async () => {
    const { loader, loads } = loaderSpy();
    const manager = createModelRuntimeManager(loader);

    await manager.ensureLoaded('m');
    await manager.ensureLoaded('m');
    await manager.ensureLoaded('m');

    assert.equal(loads.length, 1, 'a loaded model is reused, not reloaded');
    assert.equal(manager.isLoaded('m'), true);
  });

  it('collapses concurrent loads of the same model', async () => {
    const { loader, loads } = loaderSpy();
    const manager = createModelRuntimeManager(loader);

    await Promise.all([
      manager.ensureLoaded('m'),
      manager.ensureLoaded('m'),
      manager.ensureLoaded('m'),
    ]);

    assert.equal(loads.length, 1);
  });

  it('keeps different models independent', async () => {
    const { loader, loads } = loaderSpy();
    const manager = createModelRuntimeManager(loader);

    await Promise.all([manager.ensureLoaded('a'), manager.ensureLoaded('b')]);
    assert.deepEqual(loads.sort(), ['a', 'b']);
    assert.deepEqual([...manager.loaded()].sort(), ['a', 'b']);
  });

  it('does not mark a failed load as loaded', async () => {
    const { loader, loads } = loaderSpy(true);
    const manager = createModelRuntimeManager(loader);

    const result = await manager.ensureLoaded('m');
    assert.equal(result.ok, false);
    assert.equal(manager.isLoaded('m'), false);

    // The next attempt genuinely retries rather than reporting stale success.
    await manager.ensureLoaded('m');
    assert.equal(loads.length, 2);
  });

  it('unloads and forgets', async () => {
    const { loader, unloads } = loaderSpy();
    const manager = createModelRuntimeManager(loader);

    await manager.ensureLoaded('m');
    await manager.unload('m');

    assert.deepEqual(unloads, ['m']);
    assert.equal(manager.isLoaded('m'), false);
  });

  it('unloading something never loaded is a no-op', async () => {
    const { loader, unloads } = loaderSpy();
    const manager = createModelRuntimeManager(loader);

    assert.equal((await manager.unload('m')).ok, true);
    assert.deepEqual(unloads, []);
  });

  it('unloads everything', async () => {
    const { loader } = loaderSpy();
    const manager = createModelRuntimeManager(loader);

    await manager.ensureLoaded('a');
    await manager.ensureLoaded('b');
    await manager.unloadAll();

    assert.deepEqual(manager.loaded(), []);
  });
});

describe('the offline service over an engine', () => {
  /** A runtime that is present and has both requested models loaded. */
  function readyEngine(): OfflineTranslationEngine {
    return {
      ...unavailableOfflineEngine,
      id: 'offline.test',
      async isAvailable() {
        return ok(true);
      },
      async getReadyPairs() {
        return ok([{ source: 'en', target: 'de' }]);
      },
      async translate(incoming) {
        return ok({
          id: 'offline-1',
          sourceText: incoming.text,
          translatedText: 'Hallo',
          sourceLanguage: incoming.sourceLanguage,
          targetLanguage: incoming.targetLanguage,
          engine: 'offline',
          origin: incoming.origin,
          createdAt: 0,
        });
      },
    };
  }

  it('is unavailable while no runtime is installed', async () => {
    const service = createOfflineTranslationService(unavailableOfflineEngine);
    assert.equal(await service.isAvailable(), false);
    assert.equal(await service.supportsPair('en', 'de'), false);
  });

  it('reports model_missing rather than a vague failure', async () => {
    const service = createOfflineTranslationService(unavailableOfflineEngine);
    const result = await service.translate(request);
    assert.equal(!result.ok && result.error.code, 'model_missing');
  });

  it('validates the request before reaching the engine', async () => {
    let called = false;
    const engine: OfflineTranslationEngine = {
      ...readyEngine(),
      async translate(incoming) {
        called = true;
        return readyEngine().translate(incoming);
      },
    };

    const result = await createOfflineTranslationService(engine).translate({
      ...request,
      text: '   ',
    });
    assert.equal(!result.ok && result.error.code, 'invalid_request');
    assert.equal(called, false);
  });

  it('translates through a ready engine', async () => {
    const service = createOfflineTranslationService(readyEngine());
    assert.equal(await service.isAvailable(), true);
    assert.equal(await service.supportsPair('en', 'de'), true);
    assert.equal(await service.supportsPair('de', 'en'), false, 'only the reported pair is ready');

    const result = await service.translate(request);
    assert.equal(result.ok && result.value.translatedText, 'Hallo');
    assert.equal(result.ok && result.value.engine, 'offline');
  });
});

describe('routing with the offline engine', () => {
  const onlineEngine: TranslationService = {
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

  const offlineService = createOfflineTranslationService(unavailableOfflineEngine);

  const routerWith = (mode: TranslationMode) =>
    createTranslationRouter({ engines: [onlineEngine, offlineService], mode: () => mode });

  it('offline mode never falls back to online', async () => {
    const result = await routerWith('offline').translate(request);
    assert.equal(result.ok, false, 'must not quietly use the network');
    assert.equal(!result.ok && result.error.code, 'model_missing');
  });

  it('online mode never invokes the offline engine', async () => {
    let offlineCalled = false;
    const spy = createOfflineTranslationService({
      ...unavailableOfflineEngine,
      async translate(incoming) {
        offlineCalled = true;
        return unavailableOfflineEngine.translate(incoming);
      },
    });

    const router = createTranslationRouter({
      engines: [onlineEngine, spy],
      mode: () => 'online',
    });

    const result = await router.translate(request);
    assert.equal(result.ok && result.value.translatedText, 'from-online');
    assert.equal(offlineCalled, false);
  });

  it('auto mode uses online while no model is installed', async () => {
    const result = await routerWith('auto').translate(request);
    assert.equal(result.ok && result.value.engine, 'online');
  });

  it('auto mode prefers offline when connectivity is gone and a model is ready', async () => {
    const readyOffline = createOfflineTranslationService({
      ...unavailableOfflineEngine,
      async isAvailable() {
        return ok(true);
      },
      async getReadyPairs() {
        return ok([{ source: 'en', target: 'de' }]);
      },
      async translate(incoming) {
        return ok({
          id: 'offline-2',
          sourceText: incoming.text,
          translatedText: 'from-offline',
          sourceLanguage: incoming.sourceLanguage,
          targetLanguage: incoming.targetLanguage,
          engine: 'offline',
          origin: incoming.origin,
          createdAt: 0,
        });
      },
    });

    const router = createTranslationRouter({
      engines: [onlineEngine, readyOffline],
      network: {
        id: 'net',
        isAvailable: async () => true,
        getStatus: async () => 'offline',
        subscribe: () => () => {},
      },
      mode: () => 'auto',
    });

    const result = await router.translate(request);
    assert.equal(result.ok && result.value.translatedText, 'from-offline');
  });

  it('the sample engine still works in every mode', async () => {
    for (const mode of ['auto', 'online', 'offline'] as TranslationMode[]) {
      const router = createTranslationRouter({
        engines: [mockTranslationService],
        mode: () => mode,
      });
      assert.equal((await router.translate(request)).ok, true, `mode ${mode}`);
    }
  });
});

describe('model storage', () => {
  /** An in-memory ModelStorage: the same seam the file implementation fills. */
  function memoryStorage(): ModelStorage & { put: (id: string, size: number) => void } {
    const files = new Map<string, number>();
    return {
      put: (id, size) => files.set(id, size),
      async exists(modelId) {
        return ok(files.has(modelId));
      },
      async getPath(modelId) {
        return ok(`/models/${toModelFilename(modelId)}`);
      },
      async getSize(modelId) {
        return ok(files.get(modelId) ?? 0);
      },
      async remove(modelId) {
        files.delete(modelId);
        return ok(undefined);
      },
      async totalSize() {
        return ok([...files.values()].reduce((total, size) => total + size, 0));
      },
      async list() {
        return ok([...files.keys()]);
      },
    };
  }

  it('reports presence, size and total', async () => {
    const storage = memoryStorage();
    assert.equal(unwrap(await storage.exists('a')), false);
    assert.equal(unwrap(await storage.getSize('a')), 0);

    storage.put('a', 100);
    storage.put('b', 50);
    assert.equal(unwrap(await storage.exists('a')), true);
    assert.equal(unwrap(await storage.totalSize()), 150);
  });

  it('removing something absent is not an error', async () => {
    assert.equal((await memoryStorage().remove('missing')).ok, true);
  });

  it('turns a namespaced model id into one safe path segment', () => {
    assert.equal(toModelFilename('runtime:zh-Hans'), 'runtime_zh-Hans');
    assert.equal(toModelFilename('../../etc/passwd'), '.._.._etc_passwd');
    assert.equal(toModelFilename('a/b\\c'), 'a_b_c');
    assert.ok(!toModelFilename('x:y/z').includes('/'));
  });

  it('surfaces filesystem trouble as storage_error', async () => {
    // The real implementation is built the same way as the other platform
    // seams; under Node its dependency is stubbed, so calling it must fail
    // cleanly rather than throwing.
    const storage = createFileModelStorage();
    const result = await storage.exists('anything');
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, 'storage_error');
  });
});
