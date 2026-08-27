import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { DEFAULTS } from '@/constants';
import type { LanguageId, LanguagePair } from '@/types';

import { applySource, applySwap, applyTarget, canSwap, remember } from './language-pair-rules';

export type LanguageField = 'source' | 'target';

type State = {
  pair: LanguagePair;
  /** Most recently chosen first. Excludes the detect sentinel. */
  recentSource: readonly LanguageId[];
  recentTarget: readonly LanguageId[];
};

type Action =
  { type: 'setSource'; id: LanguageId } | { type: 'setTarget'; id: LanguageId } | { type: 'swap' };

const INITIAL: State = {
  pair: { source: DEFAULTS.sourceLanguage, target: DEFAULTS.targetLanguage },
  recentSource: [],
  recentTarget: [],
};

function reducer(state: State, action: Action): State {
  const { pair } = state;

  switch (action.type) {
    case 'setSource': {
      const next = applySource(pair, action.id);
      return {
        pair: next,
        recentSource: remember(state.recentSource, action.id),
        // A swap also moved the other side, so record what landed there.
        recentTarget:
          next.target === pair.source
            ? remember(state.recentTarget, next.target)
            : state.recentTarget,
      };
    }

    case 'setTarget': {
      const next = applyTarget(pair, action.id);
      return {
        pair: next,
        recentSource:
          next.source === pair.target
            ? remember(state.recentSource, next.source)
            : state.recentSource,
        recentTarget: remember(state.recentTarget, action.id),
      };
    }

    case 'swap':
      return { ...state, pair: applySwap(pair) };
  }
}

type LanguageContextValue = {
  pair: LanguagePair;
  canSwap: boolean;
  recent: { source: readonly LanguageId[]; target: readonly LanguageId[] };
  setSource: (id: LanguageId) => void;
  setTarget: (id: LanguageId) => void;
  /** Writes whichever side the picker was opened for. */
  select: (field: LanguageField, id: LanguageId) => void;
  swap: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Holds the source/target pair shared by the translate, camera and voice flows,
 * plus the recently chosen languages per side.
 *
 * Recents are in memory only. They move to `STORAGE_KEYS.languageSelection` on
 * the persistence day; the shape here is already what that will hydrate.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const value = useMemo<LanguageContextValue>(() => {
    const setSource = (id: LanguageId) => dispatch({ type: 'setSource', id });
    const setTarget = (id: LanguageId) => dispatch({ type: 'setTarget', id });

    return {
      pair: state.pair,
      canSwap: canSwap(state.pair),
      recent: { source: state.recentSource, target: state.recentTarget },
      setSource,
      setTarget,
      select: (field, id) => (field === 'source' ? setSource(id) : setTarget(id)),
      swap: () => dispatch({ type: 'swap' }),
    };
  }, [state]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguagePair(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguagePair must be used inside <LanguageProvider>.');
  }
  return context;
}
