import type { Unsubscribe } from '@/types';

import type { Service } from '../types';

/**
 * Connectivity as the app cares about it.
 *
 * `unknown` is a real answer, not a failure: on a cold start, or where the OS
 * has not yet probed reachability, we genuinely do not know. Callers must
 * decide deliberately what to do with it rather than treating it as offline.
 */
export type NetworkStatus = 'online' | 'offline' | 'unknown';

export type NetworkService = Service & {
  /** Current connectivity. Never throws; returns `unknown` if it cannot tell. */
  getStatus(): Promise<NetworkStatus>;
  /** Fires on every change. Returns the unsubscribe handle. */
  subscribe(listener: (status: NetworkStatus) => void): Unsubscribe;
};
