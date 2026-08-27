import type { ReactNode } from 'react';

import { LanguageProvider } from './language-store';
import { PreferencesProvider } from './preferences-store';

/**
 * Single composition point for global providers. New stores are added here so
 * the root layout never grows a provider pyramid.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </PreferencesProvider>
  );
}
