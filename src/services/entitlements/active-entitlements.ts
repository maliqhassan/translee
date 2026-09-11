import type { Capability, Entitlements, Plan } from './entitlements-service';
import { defaultEntitlements } from './plan-capabilities';

/**
 * The current entitlements, readable from outside React.
 *
 * The same one-way bridge as `active-preferences`, and for the same reason:
 * the service registry and the translation router are plain singletons built
 * at import time, so they cannot use a hook — but a gate in the routing layer
 * will eventually need to know what the user is entitled to.
 *
 * It is not a second source of truth. The store owns the state and publishes
 * here on every change; this only mirrors it. Nothing writes through it.
 *
 * Nothing reads it yet — the only gate in this step lives in a React hook,
 * which reads the store directly. It exists now so the first non-React gate
 * does not arrive with a new global pattern in tow.
 */
let snapshot: Entitlements = defaultEntitlements();

export function publishActiveEntitlements(entitlements: Entitlements): void {
  snapshot = entitlements;
}

export function getActiveEntitlements(): Entitlements {
  return snapshot;
}

export function getActivePlan(): Plan {
  return snapshot.plan;
}

/** Whether the current entitlement includes a capability. */
export function hasActiveCapability(capability: Capability): boolean {
  return snapshot.capabilities.has(capability);
}

/** Test seam: restores the default between cases. */
export function resetActiveEntitlements(): void {
  snapshot = defaultEntitlements();
}
