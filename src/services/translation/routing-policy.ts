import type { NetworkStatus } from '../network';

import type { TranslationService } from './translation-service';

/**
 * Decides the order engines are tried in, given connectivity.
 *
 * Pure and separate from the router so the policy can be read, reasoned about
 * and tested on its own — and so Days 8 to 11 can add "prefer offline" or
 * "offline model installed" rules by changing this file alone.
 */
export type RoutingContext = {
  network: NetworkStatus;
  /** User preference from settings: use on-device models even when online. */
  preferOffline?: boolean;
};

/**
 * Online first when there is a connection, offline first when there is not.
 *
 * Nothing is ever removed from the list, only reordered: an engine's own
 * `isAvailable` is the authority on whether it can run, and dropping
 * candidates here would make a wrong connectivity reading unrecoverable.
 * `unknown` is treated as online, because trying and failing is better than
 * refusing to try.
 */
export function orderEngines(
  engines: readonly TranslationService[],
  context: RoutingContext,
): readonly TranslationService[] {
  const offlineFirst = context.network === 'offline' || context.preferOffline === true;

  const rank = (engine: TranslationService): number => {
    if (engine.engine === 'offline') return offlineFirst ? 0 : 1;
    if (engine.engine === 'online') return offlineFirst ? 1 : 0;
    // The sample engine is a development stand-in and never outranks a real one.
    return 2;
  };

  return [...engines].sort((a, b) => rank(a) - rank(b));
}
