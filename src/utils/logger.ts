/**
 * Thin logging seam. Everything goes through here so Day 15+ can swap in a
 * real reporter (Sentry, file log) without touching call sites.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const ENABLED = __DEV__;

function write(level: Level, scope: string, message: string, meta?: unknown) {
  if (!ENABLED && level === 'debug') return;
  const line = `[${scope}] ${message}`;
  if (level === 'error') console.error(line, meta ?? '');
  else if (level === 'warn') console.warn(line, meta ?? '');
  else if (ENABLED) console.warn(line, meta ?? '');
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: unknown) => write('debug', scope, message, meta),
    info: (message: string, meta?: unknown) => write('info', scope, message, meta),
    warn: (message: string, meta?: unknown) => write('warn', scope, message, meta),
    error: (message: string, meta?: unknown) => write('error', scope, message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
