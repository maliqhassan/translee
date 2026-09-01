import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGES } from '@/constants';
import type { HttpClient } from '@/services/http/http-client';
import {
  MLKIT_LANGUAGE_CODES,
  isMlKitSupported,
  mlKitSupportedIds,
  toMlKitCode,
  unsupportedReason,
} from '@/services/translation/offline/mlkit/mlkit-languages';
import {
  createMlKitOfflineEngine,
  type MlKitNative,
} from '@/services/translation/offline/mlkit/mlkit-offline-engine';
import { createOfflineTranslationService } from '@/services/translation/offline-translation-service';
import { createOnlineTranslationService } from '@/services/translation/online-translation-service';
import { createBackendTranslationProvider } from '@/services/translation/provider/backend-translation-provider';
import { createTranslationRouter } from '@/services/translation/translation-router';
import type { TranslationService } from '@/services/translation/translation-service';
import type { TranslationMode, TranslationRequest } from '@/types';
import { ok } from '@/utils';

/**
 * Day 9: the ML Kit integration, exercised at the native seam.
 *
 * The Kotlin module cannot run under Node, so these drive the engine against a
 * fake that behaves the way ML Kit's API does. That covers every line of
 * TypeScript; it does not and cannot cover the native code, which needs a
 * device.
 */

const request: TranslationRequest = {
  text: 'Hello',
  sourceLanguage: 'en',
  targetLanguage: 'de',
  origin: 'text',
};

/** A stand-in for the native module, with ML Kit's shape and behaviour. */
function fakeNative(
  downloaded: string[] = [],
  overrides: Partial<MlKitNative> = {},
): MlKitNative & { calls: string[]; installed: Set<string> } {
  const installed = new Set(downloaded);
  const calls: string[] = [];

  return {
    calls,
    installed,
    getSupportedLanguages: () => [...MLKIT_LANGUAGE_CODES],
    async getDownloadedLanguages() {
      calls.push('getDownloadedLanguages');
      return [...installed];
    },
    async downloadModel(language: string) {
      calls.push(`downloadModel:${language}`);
      installed.add(language);
    },
    async deleteModel(language: string) {
      calls.push(`deleteModel:${language}`);
      installed.delete(language);
    },
    async translate(source: string, target: string, text: string) {
      calls.push(`translate:${source}->${target}`);
      return `[${target}] ${text}`;
    },
    async closeAll() {
      calls.push('closeAll');
    },
    ...overrides,
  };
}

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  assert.equal(result.ok, true, `expected ok, got ${JSON.stringify(result)}`);
  if (!result.ok) throw new Error('unreachable');
  return result.value;
};

describe('ML Kit language mapping', () => {
  it('carries ML Kit’s real 59-language list', () => {
    assert.equal(MLKIT_LANGUAGE_CODES.length, 59);
    assert.equal(new Set(MLKIT_LANGUAGE_CODES).size, 59, 'no duplicates');
  });

  it('maps the plain languages straight through', () => {
    for (const id of ['en', 'de', 'es', 'fr', 'ja', 'ar', 'ur', 'ru', 'hi']) {
      assert.equal(toMlKitCode(id), id, id);
      assert.equal(isMlKitSupported(id), true, id);
    }
  });

  it('refuses script variants ML Kit cannot express', () => {
    // ML Kit has one unqualified "zh"; promising Traditional would risk
    // returning the wrong script entirely.
    for (const id of ['zh-Hans', 'zh-Hant']) {
      assert.equal(toMlKitCode(id), undefined, id);
      assert.equal(isMlKitSupported(id), false, id);
      assert.match(unsupportedReason(id) ?? '', /zh/);
    }
  });

  it('refuses regional variants ML Kit cannot express', () => {
    for (const id of ['pt-BR', 'pt-PT']) {
      assert.equal(toMlKitCode(id), undefined, id);
      assert.match(unsupportedReason(id) ?? '', /pt/);
    }
  });

  it('reports languages ML Kit simply does not have', () => {
    for (const id of ['sr', 'mn']) {
      assert.equal(isMlKitSupported(id), false, id);
      assert.ok(unsupportedReason(id));
    }
  });

  it('applies only unambiguous aliases', () => {
    // One catalogue entry, one ML Kit code, no variant to get wrong.
    assert.equal(toMlKitCode('nb'), 'no');
    assert.equal(toMlKitCode('fil'), 'tl');
  });

  it('never invents a mapping for an unknown id', () => {
    assert.equal(toMlKitCode('not-a-language'), undefined);
    assert.equal(toMlKitCode(''), undefined);
  });

  it('only ever produces codes ML Kit accepts', () => {
    const codes = new Set(MLKIT_LANGUAGE_CODES);
    for (const language of LANGUAGES) {
      const code = toMlKitCode(language.id);
      if (code !== undefined) {
        assert.ok(codes.has(code), `${language.id} mapped to unknown code ${code}`);
      }
    }
  });

  it('supports a substantial share of the catalogue', () => {
    const supported = mlKitSupportedIds(LANGUAGES);
    assert.equal(supported.length, 55);
    assert.ok(supported.length < LANGUAGES.length, 'and honestly reports the rest as absent');
  });

  it('keeps every LanguageId distinct: no two ids share a code', () => {
    const seen = new Map<string, string>();
    for (const id of mlKitSupportedIds(LANGUAGES)) {
      const code = toMlKitCode(id);
      assert.ok(code);
      assert.equal(seen.has(code), false, `${id} and ${seen.get(code)} both map to ${code}`);
      seen.set(code, id);
    }
  });
});

describe('the engine without a native module', () => {
  const engine = createMlKitOfflineEngine({ native: null });

  it('reports itself unavailable rather than throwing', async () => {
    assert.equal(unwrap(await engine.isAvailable()), false);
    assert.deepEqual(unwrap(await engine.getSupportedLanguages()), []);
    assert.deepEqual(unwrap(await engine.getReadyPairs()), []);
    assert.deepEqual(unwrap(await engine.listModels()), []);
  });

  it('returns model_missing for translation and loading', async () => {
    const translated = await engine.translate(request);
    assert.equal(!translated.ok && translated.error.code, 'model_missing');

    const loaded = await engine.loadModel('mlkit:de');
    assert.equal(!loaded.ok && loaded.error.code, 'model_missing');
  });
});

describe('model status and lifecycle', () => {
  it('lists every supported language, none installed at first', async () => {
    const engine = createMlKitOfflineEngine({ native: fakeNative() });
    const models = unwrap(await engine.listModels());

    assert.equal(models.length, 55);
    assert.ok(models.every((model) => model.status === 'not_installed'));
    assert.ok(models.every((model) => model.id.startsWith('mlkit:')));
  });

  it('never invents a size or a checksum', async () => {
    const engine = createMlKitOfflineEngine({ native: fakeNative(['de']) });
    const models = unwrap(await engine.listModels());

    // ML Kit exposes neither, so neither is reported.
    assert.ok(models.every((model) => model.sizeBytes === undefined));
    assert.ok(models.every((model) => model.checksum === undefined));
  });

  it('reflects what ML Kit says is downloaded', async () => {
    const engine = createMlKitOfflineEngine({ native: fakeNative(['en', 'de']) });
    const models = unwrap(await engine.listModels());
    const ready = models.filter((model) => model.status === 'ready').map((m) => m.language);

    assert.deepEqual(ready.sort(), ['de', 'en']);
  });

  it('downloads a model and then reports it ready', async () => {
    const native = fakeNative();
    const engine = createMlKitOfflineEngine({ native });

    assert.equal((await engine.downloadModel('mlkit:de')).ok, true);
    assert.ok(native.calls.includes('downloadModel:de'));

    const models = unwrap(await engine.listModels());
    assert.equal(models.find((model) => model.language === 'de')?.status, 'ready');
  });

  it('deletes a model and stops reporting it ready', async () => {
    const native = fakeNative(['de']);
    const engine = createMlKitOfflineEngine({ native });

    assert.equal((await engine.deleteModel('mlkit:de')).ok, true);
    assert.ok(native.calls.includes('deleteModel:de'));
    assert.equal(native.installed.has('de'), false);
  });

  it('refuses to download a language ML Kit cannot serve', async () => {
    const native = fakeNative();
    const engine = createMlKitOfflineEngine({ native });

    const result = await engine.downloadModel('mlkit:zh-Hant');
    assert.equal(!result.ok && result.error.code, 'unsupported_language');
    assert.equal(native.calls.length, 0, 'nothing should reach the native module');
  });

  it('maps a native download failure to model_missing', async () => {
    const native = fakeNative([], {
      async downloadModel() {
        throw { code: 'model_download_failed', message: 'no network' };
      },
    });
    const result = await createMlKitOfflineEngine({ native }).downloadModel('mlkit:de');
    assert.equal(!result.ok && result.error.code, 'model_missing');
  });

  it('maps a native query failure to storage_error and keeps working', async () => {
    const native = fakeNative([], {
      async getDownloadedLanguages() {
        throw { code: 'model_query_failed' };
      },
    });
    const engine = createMlKitOfflineEngine({ native });
    // An unreadable model list means nothing is known to be ready, not a crash.
    assert.deepEqual(unwrap(await engine.getReadyPairs()), []);
  });
});

describe('pair readiness needs both models', () => {
  it('is not ready with only one side', async () => {
    const engine = createMlKitOfflineEngine({ native: fakeNative(['en']) });
    const pairs = unwrap(await engine.getReadyPairs());
    assert.equal(pairs.length, 0);
  });

  it('is ready in both directions once both are downloaded', async () => {
    const engine = createMlKitOfflineEngine({ native: fakeNative(['en', 'de']) });
    const pairs = unwrap(await engine.getReadyPairs());

    assert.equal(pairs.length, 2);
    assert.ok(pairs.some((pair) => pair.source === 'en' && pair.target === 'de'));
    assert.ok(pairs.some((pair) => pair.source === 'de' && pair.target === 'en'));
  });

  it('never offers a same-language pair', async () => {
    const engine = createMlKitOfflineEngine({ native: fakeNative(['en', 'de', 'fr']) });
    const pairs = unwrap(await engine.getReadyPairs());
    assert.ok(pairs.every((pair) => pair.source !== pair.target));
  });
});

describe('offline translation', () => {
  it('translates when both models are present', async () => {
    const native = fakeNative(['en', 'de']);
    const result = await createMlKitOfflineEngine({ native }).translate(request);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.translatedText, '[de] Hello');
    assert.equal(result.value.engine, 'offline');
    assert.equal(result.value.sourceLanguage, 'en');
    assert.equal(result.value.targetLanguage, 'de');
    assert.ok(native.calls.includes('translate:en->de'));
  });

  it('returns model_missing when a model is absent', async () => {
    const native = fakeNative(['en']);
    const result = await createMlKitOfflineEngine({ native }).translate(request);

    assert.equal(!result.ok && result.error.code, 'model_missing');
    assert.equal(
      native.calls.some((call) => call.startsWith('translate:')),
      false,
      'nothing should be translated without both models',
    );
  });

  it('returns unsupported_language for a language ML Kit lacks', async () => {
    const engine = createMlKitOfflineEngine({ native: fakeNative(['en', 'de']) });
    const result = await engine.translate({ ...request, targetLanguage: 'sr' });
    assert.equal(!result.ok && result.error.code, 'unsupported_language');
  });

  it('refuses auto as a source rather than guessing', async () => {
    // Language identification is a separate ML Kit API this build does not use.
    const engine = createMlKitOfflineEngine({ native: fakeNative(['en', 'de']) });
    const result = await engine.translate({ ...request, sourceLanguage: 'auto' });
    assert.equal(!result.ok && result.error.code, 'unsupported_language');
  });

  it('never leaks a native error message to the caller', async () => {
    const native = fakeNative(['en', 'de'], {
      async translate() {
        // A native failure whose message echoes the user's text.
        throw { code: 'translate_failed', message: 'failed translating "my private sentence"' };
      },
    });

    const result = await createMlKitOfflineEngine({ native }).translate(request);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(!JSON.stringify(result.error).includes('my private sentence'));
  });

  it('handles repeated translations', async () => {
    const native = fakeNative(['en', 'de']);
    const engine = createMlKitOfflineEngine({ native });

    for (let index = 0; index < 3; index += 1) {
      assert.equal((await engine.translate(request)).ok, true);
    }
    assert.equal(native.calls.filter((call) => call.startsWith('translate:')).length, 3);
  });

  it('handles concurrent translations', async () => {
    const native = fakeNative(['en', 'de']);
    const engine = createMlKitOfflineEngine({ native });

    const results = await Promise.all([
      engine.translate(request),
      engine.translate(request),
      engine.translate({ ...request, targetLanguage: 'fr' }),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 2);
    // French is not downloaded, so that one is refused rather than fetched.
    assert.equal(!results[2]?.ok && results[2]?.error.code, 'model_missing');
  });
});

describe('routing with the real engine', () => {
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

  const offlineWith = (downloaded: string[], native = true) =>
    createOfflineTranslationService(
      createMlKitOfflineEngine({ native: native ? fakeNative(downloaded) : null }),
    );

  const routerWith = (offline: TranslationService, mode: TranslationMode) =>
    createTranslationRouter({ engines: [onlineEngine, offline], mode: () => mode });

  it('offline mode translates on device when models are ready', async () => {
    const result = await routerWith(offlineWith(['en', 'de']), 'offline').translate(request);
    assert.equal(result.ok && result.value.engine, 'offline');
    assert.equal(result.ok && result.value.translatedText, '[de] Hello');
  });

  it('offline mode never falls back to the network', async () => {
    // No models installed: the user chose on-device, so this must fail.
    const result = await routerWith(offlineWith([]), 'offline').translate(request);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, 'model_missing');
  });

  it('offline mode with no native build still refuses the network', async () => {
    const result = await routerWith(offlineWith([], false), 'offline').translate(request);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, 'model_missing');
  });

  it('online mode never invokes the on-device engine', async () => {
    const native = fakeNative(['en', 'de']);
    const offline = createOfflineTranslationService(createMlKitOfflineEngine({ native }));

    const result = await createTranslationRouter({
      engines: [onlineEngine, offline],
      mode: () => 'online',
    }).translate(request);

    assert.equal(result.ok && result.value.translatedText, 'from-online');
    assert.equal(
      native.calls.some((call) => call.startsWith('translate:')),
      false,
    );
  });

  it('auto mode uses the network while no model is installed', async () => {
    const result = await routerWith(offlineWith([]), 'auto').translate(request);
    assert.equal(result.ok && result.value.engine, 'online');
  });

  it('auto mode uses the device when there is no connection and a model is ready', async () => {
    const router = createTranslationRouter({
      engines: [onlineEngine, offlineWith(['en', 'de'])],
      network: {
        id: 'net',
        isAvailable: async () => true,
        getStatus: async () => 'offline',
        subscribe: () => () => {},
      },
      mode: () => 'auto',
    });

    const result = await router.translate(request);
    assert.equal(result.ok && result.value.engine, 'offline');
  });
});

describe('the offline guarantee, proved at the request layer', () => {
  /**
   * Network isolation needs a device, which is not available. This proves the
   * same property one level lower instead: with `translationMode: 'offline'`,
   * the HTTP client the online engine would use is never called at all.
   *
   * It is not a substitute for testing with the radio off — it is the strongest
   * evidence obtainable without hardware.
   */
  function spyingOnlineService() {
    const sent: string[] = [];
    const http: HttpClient = {
      async send(outgoing) {
        sent.push(outgoing.url);
        return ok({ status: 200, ok: true, data: { translatedText: 'FROM THE NETWORK' } });
      },
    };

    const service = createOnlineTranslationService({
      provider: createBackendTranslationProvider({
        baseUrl: 'https://api.example.test',
        translatePath: '/translation',
        http,
      }),
      network: {
        id: 'net',
        isAvailable: async () => true,
        getStatus: async () => 'online',
        subscribe: () => () => {},
      },
      retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    });

    return { service, sent };
  }

  it('sends nothing to the backend when a model is missing', async () => {
    const online = spyingOnlineService();
    const router = createTranslationRouter({
      engines: [
        online.service,
        createOfflineTranslationService(createMlKitOfflineEngine({ native: fakeNative([]) })),
      ],
      mode: () => 'offline',
    });

    const result = await router.translate(request);

    assert.equal(!result.ok && result.error.code, 'model_missing');
    assert.deepEqual(online.sent, [], 'not one request may leave the device');
  });

  it('sends nothing to the backend when translating on device', async () => {
    const online = spyingOnlineService();
    const router = createTranslationRouter({
      engines: [
        online.service,
        createOfflineTranslationService(
          createMlKitOfflineEngine({ native: fakeNative(['en', 'de']) }),
        ),
      ],
      mode: () => 'offline',
    });

    const result = await router.translate(request);

    assert.equal(result.ok && result.value.engine, 'offline');
    assert.equal(result.ok && result.value.translatedText, '[de] Hello');
    assert.deepEqual(online.sent, [], 'the on-device path must not touch the network');
  });

  it('sends nothing to the backend for an unsupported language', async () => {
    const online = spyingOnlineService();
    const router = createTranslationRouter({
      engines: [
        online.service,
        createOfflineTranslationService(
          createMlKitOfflineEngine({ native: fakeNative(['en', 'de']) }),
        ),
      ],
      mode: () => 'offline',
    });

    const result = await router.translate({ ...request, targetLanguage: 'sr' });

    assert.equal(result.ok, false);
    assert.deepEqual(online.sent, []);
  });

  it('does reach the backend in online mode, so the spy is known to work', async () => {
    const online = spyingOnlineService();
    const router = createTranslationRouter({
      engines: [
        online.service,
        createOfflineTranslationService(
          createMlKitOfflineEngine({ native: fakeNative(['en', 'de']) }),
        ),
      ],
      mode: () => 'online',
    });

    const result = await router.translate(request);

    assert.equal(result.ok && result.value.translatedText, 'FROM THE NETWORK');
    assert.equal(online.sent.length, 1, 'the spy records real traffic');
  });
});
