import type { TranslationEngine, TranslationMode } from '@/types';

import type { NetworkStatus } from '../network';

import type { TranslationService } from './translation-service';

/**
 * Decides which engines are eligible for a request, and in what order.
 *
 * Pure and separate from the router so the policy can be read, reasoned about
 * and tested on its own — and so the offline days can change routing by
 * editing this file alone.
 */
export type RoutingContext = {
  network: NetworkStatus;
  /**
   * The user's translation mode. `auto` lets connectivity decide; `online` and
   * `offline` are restrictions the user chose and the router honours literally.
   */
  mode?: TranslationMode;
  /**
   * Day 4's spelling of `mode: 'offline'`, kept because the routing policy was
   * introduced with this name. Ignored when `mode` is given.
   */
  preferOffline?: boolean;
};

function resolveMode(context: RoutingContext): TranslationMode {
  if (context.mode) return context.mode;
  return context.preferOffline ? 'offline' : 'auto';
}

/**
 * Engines the mode permits.
 *
 * A restriction the user set is honoured rather than quietly widened: picking
 * `offline` and silently getting a network translation would be a lie, and the
 * router reports the honest unavailable error instead.
 *
 * The sample engine is exempt. It is a development stand-in for whichever
 * engine is missing, and its results are always badged `Sample`, so it can
 * never be mistaken for the real thing.
 */
function isEligible(engine: TranslationEngine, mode: TranslationMode): boolean {
  if (engine === 'mock' || mode === 'auto') return true;
  return engine === mode;
}

/**
 * Online first when there is a connection, offline first when there is not.
 *
 * Within the eligible set nothing is removed for connectivity reasons, only
 * reordered: an engine's own `isAvailable` is the authority on whether it can
 * run, and dropping candidates on a connectivity guess would make a wrong
 * reading unrecoverable. `unknown` is treated as online, because trying and
 * failing beats refusing to try.
 */
export function orderEngines(
  engines: readonly TranslationService[],
  context: RoutingContext,
): readonly TranslationService[] {
  const mode = resolveMode(context);
  const offlineFirst = context.network === 'offline' || mode === 'offline';

  const rank = (engine: TranslationService): number => {
    if (engine.engine === 'offline') return offlineFirst ? 0 : 1;
    if (engine.engine === 'online') return offlineFirst ? 1 : 0;
    // The sample engine is a development stand-in and never outranks a real one.
    return 2;
  };

  return engines
    .filter((engine) => isEligible(engine.engine, mode))
    .sort((a, b) => rank(a) - rank(b));
}
