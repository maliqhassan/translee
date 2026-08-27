import type { Service, ServiceResult } from '../types';

/**
 * Clipboard access behind an interface, so screens never touch a platform API
 * directly and copy/paste can be stubbed in tests.
 */
export type ClipboardService = Service & {
  copy(text: string): ServiceResult<void>;
  paste(): ServiceResult<string>;
  /** Cheap check used to decide whether to offer a paste affordance. */
  hasText(): Promise<boolean>;
};
