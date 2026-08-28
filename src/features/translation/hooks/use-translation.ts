import { useCallback, useRef, useState } from 'react';

import { recordTranslation } from '@/features/history';
import { services } from '@/services';
import { useLanguagePair } from '@/store';
import type { AsyncState, LanguageCode, TranslationResult } from '@/types';

export type TranslationController = {
  input: string;
  setInput: (text: string) => void;
  clearInput: () => void;
  state: AsyncState<TranslationResult>;
  /** True when there is something worth sending to an engine. */
  canTranslate: boolean;
  translate: () => void;
  /** Drops the current result without clearing what the user typed. */
  reset: () => void;
};

/** A result is only meaningful for the pair it was requested with. */
type Snapshot = {
  source: LanguageCode;
  target: LanguageCode;
  value: AsyncState<TranslationResult>;
};

const IDLE: AsyncState<TranslationResult> = { status: 'idle' };

/**
 * Owns the translate screen's async lifecycle: the draft text, the in-flight
 * request and the result. The screen renders this state and nothing else, and
 * the engine is reached only through `services.translation.router`.
 */
export function useTranslation(): TranslationController {
  const { pair } = useLanguagePair();
  const [input, setInputState] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot>({
    source: pair.source,
    target: pair.target,
    value: IDLE,
  });

  /** Bumped whenever a pending response stops being relevant. */
  const requestId = useRef(0);

  // Derived rather than synced: switching languages makes an existing result
  // stale, and it becomes relevant again if the user switches back.
  const state =
    snapshot.source === pair.source && snapshot.target === pair.target ? snapshot.value : IDLE;

  const settle = useCallback(
    (value: AsyncState<TranslationResult>, source: LanguageCode, target: LanguageCode) => {
      setSnapshot({ source, target, value });
    },
    [],
  );

  const setInput = useCallback(
    (text: string) => {
      setInputState(text);
      // Editing supersedes whatever was showing or in flight.
      requestId.current += 1;
      settle(IDLE, pair.source, pair.target);
    },
    [pair.source, pair.target, settle],
  );

  const translate = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    requestId.current += 1;
    const id = requestId.current;
    const { source, target } = pair;

    settle({ status: 'loading' }, source, target);

    void services.translation.router
      .translate({ text, sourceLanguage: source, targetLanguage: target, origin: 'text' })
      .then((result) => {
        if (id !== requestId.current) return;
        if (result.ok) {
          // Recent translations read from the session store; a cache replay is
          // de-duplicated there rather than here.
          recordTranslation(result.value);
        }

        settle(
          result.ok
            ? { status: 'success', data: result.value }
            : { status: 'error', error: result.error },
          source,
          target,
        );
      });
  }, [input, pair, settle]);

  const reset = useCallback(() => {
    requestId.current += 1;
    settle(IDLE, pair.source, pair.target);
  }, [pair.source, pair.target, settle]);

  const clearInput = useCallback(() => {
    setInputState('');
    requestId.current += 1;
    settle(IDLE, pair.source, pair.target);
  }, [pair.source, pair.target, settle]);

  return {
    input,
    setInput,
    clearInput,
    state,
    canTranslate: input.trim().length > 0,
    translate,
    reset,
  };
}
