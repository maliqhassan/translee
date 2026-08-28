import { Directory, File, Paths } from 'expo-file-system';

import { appError, createLogger, err, ok } from '@/utils';

import type { PreferencesStorage } from './preferences-storage';

const log = createLogger('preferences.storage');

/** Lives in the document directory, so it survives cache eviction. */
export const PREFERENCES_FILENAME = 'preferences.json';

/**
 * The only file in the app that imports expo-file-system.
 *
 * A single small JSON document in the app's private storage. It is never
 * uploaded and never leaves the device; deleting the app deletes it.
 */
export function createFilePreferencesStorage(
  filename: string = PREFERENCES_FILENAME,
): PreferencesStorage {
  const file = () => new File(new Directory(Paths.document), filename);

  return {
    async read() {
      try {
        const handle = file();
        // A first launch has no file; that is not a failure.
        if (!handle.exists) return ok(null);
        return ok(await handle.text());
      } catch (cause) {
        // The contents are never logged — they are the user's settings.
        log.warn('could not read preferences');
        return err(appError('storage_error', 'Preferences could not be read.', cause));
      }
    },

    async write(contents: string) {
      try {
        const handle = file();
        if (!handle.exists) handle.create();
        handle.write(contents);
        return ok(undefined);
      } catch (cause) {
        log.warn('could not write preferences');
        return err(appError('storage_error', 'Preferences could not be saved.', cause));
      }
    },

    async remove() {
      try {
        const handle = file();
        if (handle.exists) handle.delete();
        return ok(undefined);
      } catch (cause) {
        log.warn('could not remove preferences');
        return err(appError('storage_error', 'Preferences could not be cleared.', cause));
      }
    },
  };
}
