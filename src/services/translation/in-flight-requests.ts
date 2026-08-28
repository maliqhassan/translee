/**
 * Collapses concurrent identical requests onto one in-flight promise.
 *
 * Two taps on Translate, or a screen remounting mid-request, should not become
 * two network calls. Anything already running for the same key is shared; once
 * it settles the entry is dropped, so this never acts as a cache.
 */
export type InFlightRegistry = {
  run<T>(key: string, operation: () => Promise<T>): Promise<T>;
  /** Number of operations currently sharing a slot. Exposed for tests. */
  readonly size: number;
};

export function createInFlightRegistry(): InFlightRegistry {
  const pending = new Map<string, Promise<unknown>>();

  return {
    run<T>(key: string, operation: () => Promise<T>): Promise<T> {
      const existing = pending.get(key);
      // The map is only ever written by `run` below, so the stored promise
      // always resolves to the same T for a given key.
      if (existing) return existing as Promise<T>;

      const started = operation().finally(() => {
        pending.delete(key);
      });

      pending.set(key, started);
      return started;
    },

    get size() {
      return pending.size;
    },
  };
}
