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
  /**
   * Whether the user may use the on-device engine at all.
   *
   * A getter rather than a value, and read on every call, because a plan can
   * change between two translations and the next one must honour it. Omitted
   * means permitted, which keeps every caller that predates entitlements —
   * and every test that does not care about them — behaving exactly as before.
   */
  offlineEntitled?: () => boolean;
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
 * The sample engine used to be exempt from this, on the reasoning that it is a
 * development stand-in and its results are badged `Sample`. That was safe while
 * no real offline engine existed and became wrong once one did: it let a sample
 * result satisfy "on-device only" on a device with the models actually
 * installed. A badge is not consent. The sample engine is now eligible only in
 * `auto`, where the user has expressed no preference, and `rank` still places
 * it behind every real engine.
 *
 * The entitlement is checked first, and that order is the whole gate. Removing
 * the engine here means it is never asked whether it is available and never
 * asked whether it covers the pair — so installed language packs, a lost
 * connection, an unreachable backend and a mode persisted from a previous
 * subscription all stop being ways in. Every one of those is a bypass if the
 * check happens anywhere later.
 */
function isEligible(
  engine: TranslationEngine,
  mode: TranslationMode,
  offlineEntitled: boolean,
): boolean {
  if (engine === 'offline' && !offlineEntitled) return false;
  if (mode === 'auto') return true;
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
  // Read once per call, not per engine: one request must be decided against
  // one answer, even if the plan changes while the list is being built.
  const offlineEntitled = context.offlineEntitled?.() ?? true;
  const offlineFirst = context.network === 'offline' || mode === 'offline';

  const rank = (engine: TranslationService): number => {
    if (engine.engine === 'offline') return offlineFirst ? 0 : 1;
    if (engine.engine === 'online') return offlineFirst ? 1 : 0;
    // The sample engine is a development stand-in and never outranks a real one.
    return 2;
  };

  return engines
    .filter((engine) => isEligible(engine.engine, mode, offlineEntitled))
    .sort((a, b) => rank(a) - rank(b));
}
