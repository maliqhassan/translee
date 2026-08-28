/**
 * A fixed-window, in-memory rate limiter.
 *
 * Deliberately small. It protects the provider quota from a runaway client on
 * a single instance, and nothing more. It is not a security control and does
 * not survive a restart or coordinate across instances — doing that properly
 * means shared state, and adding Redis today would be infrastructure we have
 * no use for yet. The boundary is here so that swap is one file when it is
 * genuinely needed.
 */

export type RateLimiter = {
  /** Records a hit and reports whether the caller may proceed. */
  check(clientKey: string): { allowed: boolean; retryAfterSeconds: number };
  /** Drops expired windows. Called periodically so the map cannot grow forever. */
  sweep(now?: number): void;
  readonly size: number;
};

export type RateLimitOptions = {
  max: number;
  windowMs: number;
  now?: () => number;
};

type Window = { count: number; resetAt: number };

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const windows = new Map<string, Window>();
  const now = options.now ?? (() => Date.now());

  return {
    check(clientKey: string) {
      const currentTime = now();
      const existing = windows.get(clientKey);

      if (!existing || currentTime >= existing.resetAt) {
        windows.set(clientKey, { count: 1, resetAt: currentTime + options.windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      existing.count += 1;
      if (existing.count > options.max) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - currentTime) / 1000)),
        };
      }
      return { allowed: true, retryAfterSeconds: 0 };
    },

    sweep(at = now()) {
      for (const [key, window] of windows) {
        if (at >= window.resetAt) windows.delete(key);
      }
    },

    get size() {
      return windows.size;
    },
  };
}
