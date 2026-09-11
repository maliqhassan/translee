import type { Unsubscribe } from '@/types';
import { createLogger, ok } from '@/utils';

import type { PreferencesStorage } from '../preferences';
import type { ServiceResult } from '../types';

import { parsePlan, serializePlan } from './entitlements-schema';
import type {
  Capability,
  DevelopmentEntitlementsService,
  Entitlements,
  Plan,
} from './entitlements-service';
import { defaultEntitlements, entitlementsFor } from './plan-capabilities';

const log = createLogger('entitlements');

/**
 * Device-local entitlements, for development and for the period before
 * anything can be bought.
 *
 * It reuses `PreferencesStorage` rather than introducing a second persistence
 * mechanism: the need is identical — one small named slot of JSON — and the
 * seam already has a file-backed implementation and an in-memory one for
 * tests. Nothing new is installed for this.
 *
 * `load` never fails. Unreadable storage, invalid JSON and an unrecognised
 * plan all resolve to Free, so a settings problem can never stop the app
 * starting, and a corrupt file can never be worth more than a valid one.
 *
 * This is not a licence check. Anyone able to write to the app's own storage
 * can set the plan, and that is fine while there is nothing to buy. The
 * contract it implements is the one a server-issued entitlement will
 * implement later, so replacing it is a change in the registry alone.
 */
export function createLocalEntitlementsService(
  storage: PreferencesStorage,
): DevelopmentEntitlementsService {
  let snapshot: Entitlements = defaultEntitlements();
  const listeners = new Set<() => void>();

  const publish = (next: Entitlements) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  return {
    id: 'entitlements',

    async isAvailable() {
      return true;
    },

    current() {
      return snapshot;
    },

    async load(): Promise<Entitlements> {
      const stored = await storage.read();

      if (!stored.ok) {
        // The contents are never logged; the plan is still the user's data.
        log.warn('entitlements unreadable; using the default plan');
        publish(defaultEntitlements());
        return snapshot;
      }

      // Nothing written yet is a first launch, not a failure.
      if (stored.value === null) {
        publish(defaultEntitlements());
        return snapshot;
      }

      let plan: Plan;
      try {
        plan = parsePlan(JSON.parse(stored.value) as unknown);
      } catch {
        log.warn('entitlements were not valid JSON; using the default plan');
        publish(defaultEntitlements());
        return snapshot;
      }

      // Read from the device, so `local` — never `account`, which is reserved
      // for an entitlement a server issued after validating a receipt.
      publish(entitlementsFor(plan, 'local'));
      return snapshot;
    },

    has(capability: Capability): boolean {
      return snapshot.capabilities.has(capability);
    },

    subscribe(listener: () => void): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async setPlan(plan: Plan): ServiceResult<void> {
      // Applied in memory first, so the UI reacts immediately and a slow or
      // failing write never makes the switch feel stuck.
      publish(entitlementsFor(plan, 'local'));
      const written = await storage.write(serializePlan(plan));
      return written.ok ? ok(undefined) : written;
    },
  };
}
