import type { Progress, Unsubscribe } from '@/types';

import type { ServiceResult } from '../types';

/**
 * Fetching a model onto the device.
 *
 * No transport is implemented today: the runtime selected for Day 9 downloads
 * its own models through Google Play services and never hands us a URL, so
 * writing an HTTP downloader now would be building for a shape we have not
 * confirmed. What is fixed is the *contract* and the safety rules a downloader
 * must honour, which is what the rest of the system is written against.
 *
 * A conforming implementation must:
 *
 * - write to a temporary path and move into place only once complete, so a
 *   killed process can never leave a half-file that looks installed
 * - verify the checksum before that move, when the source publishes one
 * - delete the temporary file on failure or cancellation
 * - report progress without blocking
 * - treat cancellation as a normal outcome, not an error
 */

export type DownloadHandle = {
  readonly modelId: string;
  /** Cooperative cancellation; safe to call after completion. */
  cancel(): void;
};

export type DownloadOutcome =
  { status: 'completed'; bytes: number } | { status: 'cancelled' } | { status: 'failed' };

export type DownloadEvent =
  | { type: 'progress'; modelId: string; progress: Progress }
  | { type: 'finished'; modelId: string; outcome: DownloadOutcome };

export type ModelDownloader = {
  /**
   * Starts a download. Resolves when the model is installed, or with a failure
   * the caller can report. Implementations must be safe to call twice for the
   * same model: the second call joins the first rather than starting again.
   */
  download(modelId: string): ServiceResult<DownloadOutcome>;
  cancel(modelId: string): ServiceResult<void>;
  /** Model ids currently downloading. */
  active(): readonly string[];
  subscribe(listener: (event: DownloadEvent) => void): Unsubscribe;
};
