import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { services } from '@/services';
import type { AppError } from '@/types';

/**
 * Database readiness as React state.
 *
 * Startup deliberately does *not* block on this. Translation works without a
 * database, so gating the whole app behind storage would turn a history
 * problem into an app problem. Screens that need history read this status and
 * show their own loading or unavailable state.
 */

export type DatabaseStatus = 'initializing' | 'ready' | 'error';

export type DatabaseState = {
  status: DatabaseStatus;
  /** Set only when `status` is `error`. */
  error?: AppError;
};

const DatabaseContext = createContext<DatabaseState>({ status: 'initializing' });

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DatabaseState>({ status: 'initializing' });

  useEffect(() => {
    let active = true;

    // Opening the file and running migrations happens once, off the render
    // path, and reports through the same Result the rest of the app uses.
    void services.history.initialize().then((result) => {
      if (!active) return;
      setState(result.ok ? { status: 'ready' } : { status: 'error', error: result.error });
    });

    return () => {
      active = false;
    };
  }, []);

  return <DatabaseContext.Provider value={state}>{children}</DatabaseContext.Provider>;
}

export function useDatabaseState(): DatabaseState {
  return useContext(DatabaseContext);
}

export function useDatabaseReady(): boolean {
  return useDatabaseState().status === 'ready';
}
