import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { services } from '@/services';
import type { NetworkStatus } from '@/services';

/**
 * Connectivity as React state.
 *
 * The router reads the network *service* directly, so routing never depends on
 * React. This provider exists for the UI side of the same fact — an offline
 * banner, or a disabled control — so no component ever probes connectivity
 * itself.
 */
const NetworkContext = createContext<NetworkStatus>('unknown');

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<NetworkStatus>('unknown');

  useEffect(() => {
    let active = true;

    // Seed from the current state, then follow changes.
    void services.network.getStatus().then((current) => {
      if (active) setStatus(current);
    });

    const unsubscribe = services.network.subscribe((next) => {
      if (active) setStatus(next);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return <NetworkContext.Provider value={status}>{children}</NetworkContext.Provider>;
}

/** Current connectivity. `unknown` until the first probe resolves. */
export function useNetworkStatus(): NetworkStatus {
  return useContext(NetworkContext);
}

/** Convenience for the common "should I warn the user?" check. */
export function useIsOffline(): boolean {
  return useNetworkStatus() === 'offline';
}
