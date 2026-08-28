import type { ServiceResult } from '../types';

/**
 * Where model files live on the device.
 *
 * A narrow seam for the same reason as `Database` and `PreferencesStorage`:
 * one implementation file touches the platform API, everything above it is
 * testable without a filesystem.
 *
 * Note that the runtime selected for Day 9 manages its own model files
 * internally, so this seam exists for runtimes that hand us a file to keep —
 * and for the packs screen, which needs to report and reclaim disk space.
 */
export type ModelStorage = {
  exists(modelId: string): ServiceResult<boolean>;
  /** Absolute path a runtime can load from. Valid whether or not it exists. */
  getPath(modelId: string): ServiceResult<string>;
  /** Bytes on disk, or 0 when absent. */
  getSize(modelId: string): ServiceResult<number>;
  remove(modelId: string): ServiceResult<void>;
  /** Total bytes used by every stored model. */
  totalSize(): ServiceResult<number>;
  /** Ids of everything currently stored. */
  list(): ServiceResult<string[]>;
};

/**
 * Model ids are namespaced (`runtime:language`) and must become one safe path
 * segment. Anything outside a conservative set is replaced, so an id can never
 * escape the models directory or collide with a path separator.
 */
export function toModelFilename(modelId: string): string {
  return modelId.replace(/[^a-zA-Z0-9._-]/g, '_');
}
