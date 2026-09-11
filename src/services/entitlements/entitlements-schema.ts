import type { Plan } from './entitlements-service';
import { DEFAULT_PLAN, isPlan } from './plan-capabilities';

/**
 * The stored shape, and the rules for reading it back safely.
 *
 * Treated as untrusted input for the same reasons preferences are — a file can
 * be truncated, written by another build, or edited on a rooted device — and
 * for one more: it is the thing an unpaid user would want to edit. Anything
 * that is not exactly a plan we know falls back to Free.
 */

export const ENTITLEMENTS_VERSION = 1;

type StoredEntitlements = {
  version: number;
  plan: Plan;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads a stored plan, always returning a usable one.
 *
 * Capabilities are never read from storage: they are derived from the plan
 * through `PLAN_CAPABILITIES` every time. A stored capability list would let a
 * single edited field grant one feature, and would also go stale the moment
 * the tiers changed.
 */
export function parsePlan(payload: unknown): Plan {
  if (!isRecord(payload)) return DEFAULT_PLAN;
  return isPlan(payload.plan) ? payload.plan : DEFAULT_PLAN;
}

export function serializePlan(plan: Plan): string {
  return JSON.stringify({ version: ENTITLEMENTS_VERSION, plan } satisfies StoredEntitlements);
}
