import type { LanguageId, Progress, Unsubscribe } from '@/types';

import type { Service, ServiceResult } from '../types';

export type LanguagePackStatus =
  'not_installed' | 'queued' | 'downloading' | 'installed' | 'update_available' | 'failed';

export type LanguagePack = {
  /** Stable pack id, e.g. `en-es`. */
  id: string;
  source: LanguageId;
  target: LanguageId;
  /** Display size of the download. */
  sizeBytes: number;
  version: string;
  status: LanguagePackStatus;
  /** Epoch ms of the last successful install. */
  installedAt?: number;
};

export type LanguagePackEvent =
  | { type: 'progress'; packId: string; progress: Progress }
  | { type: 'status'; packId: string; status: LanguagePackStatus };

/**
 * Owns the catalogue and lifecycle of on-device translation models: what is
 * available, what is installed, and download/delete operations.
 */
export type LanguagePackManager = Service & {
  /** Everything the catalogue offers, merged with local install state. */
  list(): ServiceResult<LanguagePack[]>;
  get(packId: string): ServiceResult<LanguagePack>;
  download(packId: string): ServiceResult<void>;
  cancelDownload(packId: string): ServiceResult<void>;
  remove(packId: string): ServiceResult<void>;
  /** Total bytes used by installed packs, for the storage row in settings. */
  usedStorageBytes(): ServiceResult<number>;
  subscribe(listener: (event: LanguagePackEvent) => void): Unsubscribe;
};
