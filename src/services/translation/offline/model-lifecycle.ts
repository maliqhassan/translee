import type { OfflineModelStatus } from './offline-engine';

/**
 * The model lifecycle, as a state machine.
 *
 * Pure and separate from any runtime so the rules can be read and tested
 * directly. The one rule that matters most: **`ready` is only reachable from
 * `loading`**, so a model that failed to download or failed to load can never
 * be reported as usable.
 *
 *   not_installed -> downloading -> installed -> loading -> ready
 *                                      ^                     |
 *                                      +----- unloading <----+
 *
 * `error` is reachable from any working state, and recovers only by going back
 * to a state that has been re-established from scratch.
 */

export type ModelEvent =
  | 'download_started'
  | 'download_finished'
  | 'download_failed'
  | 'download_cancelled'
  | 'load_started'
  | 'load_finished'
  | 'load_failed'
  | 'unload_started'
  | 'unload_finished'
  | 'removed'
  | 'retry';

/** Statuses a model may legally move to from each status. */
const TRANSITIONS: Record<OfflineModelStatus, readonly OfflineModelStatus[]> = {
  not_installed: ['downloading'],
  downloading: ['installed', 'not_installed', 'error'],
  installed: ['loading', 'not_installed', 'downloading'],
  loading: ['ready', 'installed', 'error'],
  ready: ['unloading', 'not_installed', 'error'],
  unloading: ['installed', 'error'],
  // Recovery always restarts from a known-clean state.
  error: ['not_installed', 'installed', 'downloading'],
};

export function canTransition(from: OfflineModelStatus, to: OfflineModelStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * The status an event produces, or `undefined` when the event does not apply.
 *
 * Returning `undefined` rather than throwing keeps an out-of-order event — a
 * late callback from a cancelled download, say — from corrupting state.
 */
export function nextStatus(
  from: OfflineModelStatus,
  event: ModelEvent,
): OfflineModelStatus | undefined {
  const target = ((): OfflineModelStatus | undefined => {
    switch (event) {
      case 'download_started':
        return 'downloading';
      case 'download_finished':
        return 'installed';
      case 'download_failed':
        return 'error';
      // A cancelled download leaves nothing usable behind, so it returns to
      // not_installed rather than to an error the user must dismiss.
      case 'download_cancelled':
        return 'not_installed';
      case 'load_started':
        return 'loading';
      case 'load_finished':
        return 'ready';
      case 'load_failed':
        return 'error';
      case 'unload_started':
        return 'unloading';
      case 'unload_finished':
        return 'installed';
      case 'removed':
        return 'not_installed';
      case 'retry':
        return from === 'error' ? 'not_installed' : undefined;
    }
  })();

  if (!target) return undefined;
  return canTransition(from, target) ? target : undefined;
}

/** Statuses in which a model can serve a translation. */
export function isUsable(status: OfflineModelStatus): boolean {
  return status === 'ready';
}

/** Statuses in which the model's files are present and complete. */
export function isInstalled(status: OfflineModelStatus): boolean {
  return (
    status === 'installed' || status === 'loading' || status === 'ready' || status === 'unloading'
  );
}

/** Whether work is in flight, so a screen can show progress and block repeats. */
export function isBusy(status: OfflineModelStatus): boolean {
  return status === 'downloading' || status === 'loading' || status === 'unloading';
}
