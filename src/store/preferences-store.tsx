import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import type { ColorSchemeName } from '@/constants';

export type ThemePreference = ColorSchemeName | 'system';

export type Preferences = {
  theme: ThemePreference;
  /** Persist translations to the local history database. */
  saveHistory: boolean;
  /** Prefer an on-device model even when the network is available. */
  preferOffline: boolean;
  /** Speak the result automatically once a translation completes. */
  autoSpeakResult: boolean;
  /** Only download language packs over Wi-Fi. */
  downloadOverWifiOnly: boolean;
};

const INITIAL: Preferences = {
  theme: 'system',
  saveHistory: true,
  preferOffline: false,
  autoSpeakResult: false,
  downloadOverWifiOnly: true,
};

type Action =
  | { type: 'set'; key: keyof Preferences; value: Preferences[keyof Preferences] }
  | { type: 'reset' };

function reducer(state: Preferences, action: Action): Preferences {
  switch (action.type) {
    case 'set':
      return { ...state, [action.key]: action.value };
    case 'reset':
      return INITIAL;
  }
}

type PreferencesContextValue = {
  preferences: Preferences;
  setTheme: (theme: ThemePreference) => void;
  toggle: (key: BooleanPreference) => void;
  reset: () => void;
};

/** Keys whose value is a boolean — lets `toggle` stay type-safe. */
export type BooleanPreference = {
  [K in keyof Preferences]: Preferences[K] extends boolean ? K : never;
}[keyof Preferences];

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Day 1 keeps preferences in memory only. Persistence is wired in on the
 * storage day by hydrating this reducer from `STORAGE_KEYS.preferences`.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, dispatch] = useReducer(reducer, INITIAL);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      setTheme: (theme) => dispatch({ type: 'set', key: 'theme', value: theme }),
      toggle: (key) => dispatch({ type: 'set', key, value: !preferences[key] }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [preferences],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used inside <PreferencesProvider>.');
  }
  return context;
}
