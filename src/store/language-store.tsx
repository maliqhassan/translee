import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { DEFAULTS } from '@/constants';
import type { LanguageCode, LanguagePair } from '@/types';

type Action =
  | { type: 'setSource'; code: LanguageCode }
  | { type: 'setTarget'; code: LanguageCode }
  | { type: 'swap' };

const INITIAL: LanguagePair = {
  source: DEFAULTS.sourceLanguage,
  target: DEFAULTS.targetLanguage,
};

function reducer(state: LanguagePair, action: Action): LanguagePair {
  switch (action.type) {
    case 'setSource':
      return action.code === state.target
        ? { source: action.code, target: state.source }
        : { ...state, source: action.code };
    case 'setTarget':
      return action.code === state.source
        ? { source: state.target, target: action.code }
        : { ...state, target: action.code };
    case 'swap':
      // `auto` can never become a target, so swapping is a no-op in that case.
      return state.source === 'auto' ? state : { source: state.target, target: state.source };
  }
}

type LanguageContextValue = {
  pair: LanguagePair;
  canSwap: boolean;
  setSource: (code: LanguageCode) => void;
  setTarget: (code: LanguageCode) => void;
  swap: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Holds the source/target pair shared by the translate, camera and voice flows. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [pair, dispatch] = useReducer(reducer, INITIAL);

  const value = useMemo<LanguageContextValue>(
    () => ({
      pair,
      canSwap: pair.source !== 'auto',
      setSource: (code) => dispatch({ type: 'setSource', code }),
      setTarget: (code) => dispatch({ type: 'setTarget', code }),
      swap: () => dispatch({ type: 'swap' }),
    }),
    [pair],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguagePair(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguagePair must be used inside <LanguageProvider>.');
  }
  return context;
}
