import type { ReactNode } from 'react';

import { DatabaseProvider } from './database-store';
import { LanguageProvider } from './language-store';
import { NetworkProvider } from './network-store';
import { PreferencesProvider } from './preferences-store';

/**
 * Single composition point for global providers. New stores are added here so
 * the root layout never grows a provider pyramid.
 *
 * `DatabaseProvider` is outermost but does not gate rendering: it reports
 * readiness, and only the screens that need history wait on it.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <DatabaseProvider>
      <NetworkProvider>
        <PreferencesProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </PreferencesProvider>
      </NetworkProvider>
    </DatabaseProvider>
  );
}
