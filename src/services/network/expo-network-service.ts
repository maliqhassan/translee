import * as Network from 'expo-network';

import { createLogger } from '@/utils';

import type { NetworkService, NetworkStatus } from './network-service';

const log = createLogger('network');

/**
 * Reduces Expo's network state to the three answers the app acts on.
 *
 * `isInternetReachable` is the field that matters: a device can be firmly
 * attached to Wi-Fi that goes nowhere. Where the platform leaves it undefined
 * we report `unknown` rather than guessing, so callers can decide.
 */
export function toNetworkStatus(state: {
  isConnected?: boolean;
  isInternetReachable?: boolean;
}): NetworkStatus {
  if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
  if (state.isConnected === true && state.isInternetReachable === true) return 'online';
  if (state.isConnected === true) return 'unknown';
  return 'unknown';
}

/** The only file in the app that imports expo-network. */
export const expoNetworkService: NetworkService = {
  id: 'network',

  async isAvailable() {
    return true;
  },

  async getStatus(): Promise<NetworkStatus> {
    try {
      return toNetworkStatus(await Network.getNetworkStateAsync());
    } catch (cause) {
      // Never let a connectivity probe break a translation; degrade to unknown.
      log.warn('network state unavailable', cause);
      return 'unknown';
    }
  },

  subscribe(listener) {
    try {
      const subscription = Network.addNetworkStateListener((event) => {
        listener(toNetworkStatus(event));
      });
      return () => subscription.remove();
    } catch (cause) {
      log.warn('network listener unavailable', cause);
      return () => {};
    }
  },
};
