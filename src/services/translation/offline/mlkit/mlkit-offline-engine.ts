import { LANGUAGES } from '@/constants';
import type { LanguageId, TranslationRequest, TranslationResult } from '@/types';
import { appError, createId, createLogger, err, ok } from '@/utils';

import type { ServiceResult } from '../../../types';
import type { OfflineModel, OfflinePair, OfflineTranslationEngine } from '../offline-engine';

import { mlKitSupportedIds, toMlKitCode } from './mlkit-languages';

const log = createLogger('offline.mlkit');

/**
 * The ML Kit runtime, behind the Day 8 `OfflineTranslationEngine` contract.
 *
 * Nothing above this file knows ML Kit exists. The native module is injected
 * rather than imported directly, so the whole engine is testable against a
 * fake without a device.
 *
 * Two things this deliberately does **not** do:
 *
 * - report download progress. ML Kit's API resolves on completion and exposes
 *   no byte count, so a percentage would be invented.
 * - report model sizes. ML Kit does not tell us, and the ~30MB figure in its
 *   documentation is prose, not an API value.
 */

/** The subset of the native module this engine uses. */
export type MlKitNative = {
  getSupportedLanguages(): string[];
  getDownloadedLanguages(): Promise<string[]>;
  downloadModel(language: string, requireWifi: boolean): Promise<void>;
  deleteModel(language: string): Promise<void>;
  translate(source: string, target: string, text: string): Promise<string>;
  closeAll(): Promise<void>;
};

export type MlKitEngineOptions = {
  /** Null when the native module was not compiled into this build. */
  native: MlKitNative | null;
  /** Download only over Wi-Fi. Defaults to true; models are tens of megabytes. */
  requireWifi?: boolean;
};

const RUNTIME_ID = 'mlkit';
const MODEL_FORMAT = 'mlkit-translate';
/** The ML Kit artifact this integration was written against. */
const MODEL_VERSION = '17.0.3';

export const MLKIT_RUNTIME_ID = RUNTIME_ID;

function modelIdFor(language: LanguageId): string {
  return `${RUNTIME_ID}:${language}`;
}

/**
 * Turns a native rejection into an app error without leaking it.
 *
 * A native message can echo the text that was being translated, so only a
 * coarse classification crosses the boundary — never the message itself.
 */
function toAppError(cause: unknown, fallback: 'model_missing' | 'unknown') {
  const code =
    typeof cause === 'object' && cause !== null && 'code' in cause
      ? String((cause as { code?: unknown }).code)
      : '';

  if (code.includes('model_missing') || code.includes('model_download_failed')) {
    return appError('model_missing', 'The language model is not available on this device.');
  }
  if (code.includes('model_delete_failed') || code.includes('model_query_failed')) {
    return appError('storage_error', 'The on-device model could not be managed.');
  }
  return appError(fallback, 'On-device translation failed.');
}

export function createMlKitOfflineEngine(options: MlKitEngineOptions): OfflineTranslationEngine {
  const { native } = options;
  const requireWifi = options.requireWifi ?? true;

  /** Catalogue ids this runtime can serve at all, computed once. */
  const supported = mlKitSupportedIds(LANGUAGES);
  const supportedSet = new Set(supported);

  function unavailable() {
    return err(appError('model_missing', 'On-device translation is not available in this build.'));
  }

  /**
   * Turns a model id into the language and ML Kit code it names.
   *
   * Every model operation needs the same two checks — that the id belongs to
   * this runtime, and that the language is one ML Kit can actually serve — so
   * they live here rather than being repeated and drifting apart.
   */
  function resolve(modelId: string) {
    const language = modelId.startsWith(`${RUNTIME_ID}:`)
      ? modelId.slice(RUNTIME_ID.length + 1)
      : modelId;

    const code = toMlKitCode(language);
    if (!code || !supportedSet.has(language)) {
      return err(appError('unsupported_language', `${language} cannot be translated on device.`));
    }
    return ok({ language, code });
  }

  /** Downloaded ML Kit codes, mapped back onto catalogue ids. */
  async function downloadedIds(): Promise<LanguageId[] | undefined> {
    if (!native) return undefined;
    try {
      const codes = new Set(await native.getDownloadedLanguages());
      return supported.filter((id) => {
        const code = toMlKitCode(id);
        return code !== undefined && codes.has(code);
      });
    } catch {
      // The cause is deliberately dropped: it is a native message that can
      // carry more than we want in a log.
      log.warn('could not read downloaded models');
      return undefined;
    }
  }

  return {
    id: 'offline.mlkit',

    async isAvailable() {
      return ok(native !== null);
    },

    async getSupportedLanguages() {
      // Only what the catalogue and ML Kit both know; never ML Kit's raw list,
      // which contains codes we have no LanguageId for.
      return ok(native ? [...supported] : []);
    },

    async getReadyPairs() {
      const ready = await downloadedIds();
      if (!ready) return ok([]);

      // A pair needs both models: ML Kit keys them by language.
      const pairs: OfflinePair[] = [];
      for (const source of ready) {
        for (const target of ready) {
          if (source !== target) pairs.push({ source, target });
        }
      }
      return ok(pairs);
    },

    async listModels() {
      if (!native) return ok([]);

      const ready = new Set((await downloadedIds()) ?? []);

      return ok(
        supported.map<OfflineModel>((language) => ({
          id: modelIdFor(language),
          language,
          format: MODEL_FORMAT,
          version: MODEL_VERSION,
          // Downloaded means usable: ML Kit loads models itself, so there is no
          // separate in-memory step for us to report.
          status: ready.has(language) ? 'ready' : 'not_installed',
          // sizeBytes and checksum are omitted on purpose — ML Kit does not
          // expose either, and inventing them would be worse than silence.
        })),
      );
    },

    async downloadModel(modelId: string) {
      if (!native) return unavailable();

      const resolved = resolve(modelId);
      if (!resolved.ok) return resolved;

      try {
        await native.downloadModel(resolved.value.code, requireWifi);
        return ok(undefined);
      } catch (cause) {
        log.warn(`could not download the model for ${resolved.value.language}`);
        return err(toAppError(cause, 'model_missing'));
      }
    },

    async deleteModel(modelId: string) {
      if (!native) return unavailable();

      const resolved = resolve(modelId);
      if (!resolved.ok) return resolved;

      try {
        await native.deleteModel(resolved.value.code);
        return ok(undefined);
      } catch (cause) {
        log.warn(`could not delete the model for ${resolved.value.language}`);
        return err(toAppError(cause, 'unknown'));
      }
    },

    async loadModel(modelId: string) {
      if (!native) return unavailable();

      const resolved = resolve(modelId);
      if (!resolved.ok) return resolved;

      // Deliberately never downloads. ML Kit owns memory residency, so the
      // only thing loading can mean here is "is it actually on the device" —
      // and answering that with a download would put the translation path on
      // the network, which is the one thing offline mode rules out.
      const ready = new Set((await downloadedIds()) ?? []);
      if (!ready.has(resolved.value.language)) {
        return err(appError('model_missing', 'That language model has not been downloaded yet.'));
      }
      return ok(undefined);
    },

    async unloadModel() {
      // ML Kit manages model residency itself and exposes no per-language
      // release, so there is nothing to do rather than something to fake.
      // Translator handles are closed by the native module on teardown.
      return ok(undefined);
    },

    async translate(request: TranslationRequest): ServiceResult<TranslationResult> {
      if (!native) return unavailable();

      const sourceCode = toMlKitCode(request.sourceLanguage);
      const targetCode = toMlKitCode(request.targetLanguage);

      // `auto` is not an ML Kit translation model: identification is a separate
      // ML Kit API that this build does not include. Say so rather than
      // guessing a source language.
      if (request.sourceLanguage === 'auto') {
        return err(
          appError(
            'unsupported_language',
            'On-device translation needs an explicit source language.',
          ),
        );
      }

      if (!sourceCode || !targetCode) {
        const missing = !sourceCode ? request.sourceLanguage : request.targetLanguage;
        return err(appError('unsupported_language', `${missing} cannot be translated on device.`));
      }

      // Both models must already be present, or this is not offline.
      const ready = new Set((await downloadedIds()) ?? []);
      if (!ready.has(request.sourceLanguage) || !ready.has(request.targetLanguage)) {
        return err(
          appError('model_missing', 'The language models for this pair are not downloaded yet.'),
        );
      }

      try {
        const translatedText = await native.translate(sourceCode, targetCode, request.text);

        return ok({
          id: createId('tr'),
          sourceText: request.text,
          translatedText,
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
          engine: 'offline',
          origin: request.origin,
          createdAt: Date.now(),
        });
      } catch (cause) {
        // Never the native message: it can contain the user's text.
        log.warn('on-device translation failed');
        return err(toAppError(cause, 'unknown'));
      }
    },
  };
}
