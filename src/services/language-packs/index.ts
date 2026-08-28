import { err, notImplemented } from '@/utils';

import type { LanguagePackManager } from './language-pack-manager';

export * from './language-availability';
export * from './language-pack-manager';
export * from './file-model-storage';
export * from './model-downloader';
export * from './model-storage';

const noop = () => {};
const unavailable = (what: string) => Promise.resolve(err(notImplemented(what)));

/** Placeholder. Catalogue and downloads land on the language-packs day. */
export const languagePackManager: LanguagePackManager = {
  id: 'language-packs',
  async isAvailable() {
    return false;
  },
  list: () => unavailable('Language pack catalogue'),
  get: () => unavailable('Language pack lookup'),
  download: () => unavailable('Language pack download'),
  cancelDownload: () => unavailable('Language pack download'),
  remove: () => unavailable('Language pack removal'),
  usedStorageBytes: () => unavailable('Language pack storage usage'),
  subscribe: () => noop,
};
