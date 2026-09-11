/**
 * The three questions a gated feature has to answer, and the order they must
 * be answered in.
 *
 * 1. Has the capability shipped in this build?  — the feature flag
 * 2. Can this device actually do it?            — the service's own probe
 * 3. May this user do it?                       — the entitlement
 *
 * The order is not cosmetic: it decides what the user is told. A phone with no
 * text recogniser must read as unavailable, never as locked, because offering
 * to sell someone a feature their device cannot run is selling them nothing.
 * Reversing the last two checks is exactly that bug, so the rule lives here as
 * one pure function rather than being re-derived in each hook.
 */

export type FeatureAccess =
  /** Not in this build, or this device cannot do it. No upsell, ever. */
  | 'unavailable'
  /** It would work here, but this plan does not include it. */
  | 'locked'
  | 'allowed';

export type FeatureAccessInput = {
  /** The build flag for the capability. */
  shipped: boolean;
  /** The service's own answer: native module present, permissions possible. */
  supported: boolean;
  /** Whether the current entitlement includes the capability. */
  entitled: boolean;
};

export function resolveFeatureAccess({
  shipped,
  supported,
  entitled,
}: FeatureAccessInput): FeatureAccess {
  if (!shipped) return 'unavailable';
  if (!supported) return 'unavailable';
  return entitled ? 'allowed' : 'locked';
}
