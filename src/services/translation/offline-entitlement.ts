import { FEATURES } from '@/constants';

import { hasActiveCapability } from '../entitlements';

/**
 * Whether the on-device engine may run for the user as they stand right now.
 *
 * One function, two callers — the routing policy and the cache — so the answer
 * cannot differ between "may this engine be chosen" and "may this stored
 * result be handed back". Two copies of this rule would eventually disagree,
 * and the disagreement would be a free upgrade.
 *
 * It reads the entitlement through `hasActiveCapability`, the module-level
 * bridge the entitlements store publishes to. That is deliberate: the router
 * and the registry are plain singletons built at import time and cannot use a
 * hook. This is not a second entitlement system — it is a read of the only one.
 *
 * Called per request rather than captured once. A plan that changes has to
 * take effect on the very next translation, and anything memoised here would
 * be precisely the stale state the gate exists to prevent.
 *
 * `resolveFeatureAccess` is deliberately not used. Its middle layer is the
 * device probe, and the whole point of this gate is to exclude the engine
 * *before* `isAvailable()` is ever asked — so there would be nothing truthful
 * to pass for it, and the call would read as a three-layer check while testing
 * one.
 */
export function offlineTranslationPermitted(): boolean {
  // Enforcement has not been switched on yet: routing behaves as it always
  // has, for every plan. See `FEATURES.offlineEntitlement`.
  if (!FEATURES.offlineEntitlement) return true;

  return hasActiveCapability('offlineTranslation');
}
