import type { Capability, EntitlementSource, Entitlements, Plan } from './entitlements-service';

/**
 * The one table that says what a plan is worth.
 *
 * Everything else in the app asks about capabilities, so this is the only
 * place a commercial decision is written down. Changing a tier, or adding
 * one, happens here and nowhere else.
 */

export const PLANS: readonly Plan[] = ['free', 'pro'];

/** Every capability the app knows about, in the order they are presented. */
export const CAPABILITIES: readonly Capability[] = [
  'cameraOcr',
  'speechRecognition',
  'offlineTranslation',
  'adFree',
  'extendedOnlineQuota',
];

/**
 * An unknown, unreadable or not-yet-loaded state is Free.
 *
 * Failing closed is the right default for something commercial: the cost of
 * being wrong is a user briefly seeing an upgrade prompt they do not need,
 * rather than a paid feature being given away.
 */
export const DEFAULT_PLAN: Plan = 'free';

/**
 * Free is the online, text-to-text product; Pro adds the capabilities that
 * cost something to run or to build.
 *
 * Note that holding the `offlineTranslation` capability is not yet what
 * decides whether on-device translation runs — routing is untouched in this
 * step, so offline works for everyone exactly as it did. The entry is here so
 * the table is complete and the decision is a product one, not a scramble
 * through the code later.
 */
export const PLAN_CAPABILITIES: Readonly<Record<Plan, readonly Capability[]>> = {
  free: [],
  pro: ['cameraOcr', 'speechRecognition', 'offlineTranslation', 'adFree', 'extendedOnlineQuota'],
};

export function capabilitiesFor(plan: Plan): ReadonlySet<Capability> {
  return new Set(PLAN_CAPABILITIES[plan]);
}

/** Builds the snapshot a service or store hands out. */
export function entitlementsFor(plan: Plan, source: EntitlementSource): Entitlements {
  return { plan, capabilities: capabilitiesFor(plan), source };
}

/** The starting point before anything has been read from storage. */
export function defaultEntitlements(): Entitlements {
  return entitlementsFor(DEFAULT_PLAN, 'default');
}

export function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && PLANS.includes(value as Plan);
}
