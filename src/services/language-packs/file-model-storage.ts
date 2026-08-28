import { Directory, File, Paths } from 'expo-file-system';

import { appError, createLogger, err, ok } from '@/utils';

import type { ModelStorage } from './model-storage';
import { toModelFilename } from './model-storage';

const log = createLogger('models.storage');

/** Models live in their own directory so the whole set can be reclaimed at once. */
export const MODEL_DIRECTORY = 'models';

/**
 * `ModelStorage` over the device filesystem.
 *
 * The only file here that imports expo-file-system, matching
 * `expo-sqlite-database.ts` and `file-preferences-storage.ts`.
 */
export function createFileModelStorage(directoryName: string = MODEL_DIRECTORY): ModelStorage {
  const directory = () => new Directory(Paths.document, directoryName);
  const file = (modelId: string) => new File(directory(), toModelFilename(modelId));

  /** Created lazily: nothing should make a directory just to ask a question. */
  function ensureDirectory() {
    const handle = directory();
    if (!handle.exists) handle.create({ intermediates: true });
    return handle;
  }

  return {
    async exists(modelId: string) {
      try {
        return ok(file(modelId).exists);
      } catch (cause) {
        log.warn('could not check for a model file');
        return err(appError('storage_error', 'Could not check model storage.', cause));
      }
    },

    async getPath(modelId: string) {
      try {
        ensureDirectory();
        return ok(file(modelId).uri);
      } catch (cause) {
        log.warn('could not resolve a model path');
        return err(appError('storage_error', 'Could not resolve the model path.', cause));
      }
    },

    async getSize(modelId: string) {
      try {
        const handle = file(modelId);
        return ok(handle.exists ? (handle.size ?? 0) : 0);
      } catch (cause) {
        log.warn('could not measure a model file');
        return err(appError('storage_error', 'Could not measure model storage.', cause));
      }
    },

    async remove(modelId: string) {
      try {
        const handle = file(modelId);
        // Removing something already gone is a success, not a failure.
        if (handle.exists) handle.delete();
        return ok(undefined);
      } catch (cause) {
        log.warn('could not remove a model file');
        return err(appError('storage_error', 'Could not remove the model.', cause));
      }
    },

    async totalSize() {
      try {
        const handle = directory();
        if (!handle.exists) return ok(0);

        let total = 0;
        for (const entry of handle.list()) {
          if (entry instanceof File) total += entry.size ?? 0;
        }
        return ok(total);
      } catch (cause) {
        log.warn('could not measure model storage');
        return err(appError('storage_error', 'Could not measure model storage.', cause));
      }
    },

    async list() {
      try {
        const handle = directory();
        if (!handle.exists) return ok([]);
        return ok(
          handle
            .list()
            .filter((entry): entry is File => entry instanceof File)
            .map((entry) => entry.name),
        );
      } catch (cause) {
        log.warn('could not list model storage');
        return err(appError('storage_error', 'Could not list stored models.', cause));
      }
    },
  };
}
