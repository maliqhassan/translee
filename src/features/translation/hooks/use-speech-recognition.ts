import { useCallback, useEffect, useRef, useState } from 'react';

import { FEATURES } from '@/constants';
import { services } from '@/services';
import type { AppError, LanguageCode } from '@/types';
import { appError } from '@/utils';

/**
 * The microphone, as the translate screen needs it.
 *
 * Owns one recognition session at a time and the state a button renders from.
 * The screen never sees the platform recogniser; it sees this.
 *
 * Recognised text is handed to the caller and nothing else. It is not logged
 * here or below, and it is not translated automatically — the user reads it,
 * edits it if the recogniser misheard, and presses Translate themselves. That
 * matches how typed text already behaves on this screen.
 */

export type SpeechStatus =
  /** The device cannot do this at all, or the capability has not shipped. */
  | 'unavailable'
  /** Ready to start. */
  | 'idle'
  /** Waiting on the permission dialog the user just triggered. */
  | 'requesting_permission'
  | 'listening'
  /** Permission refused, but it can be asked for again. */
  | 'permission_denied'
  /** Permission refused permanently; only system settings can change it. */
  | 'permission_blocked'
  | 'error';

export type SpeechController = {
  status: SpeechStatus;
  /** True while a session is running, for the button's pressed state. */
  listening: boolean;
  /** Set on the failure states, for an actionable message. */
  error?: AppError;
  /** Starts if idle, stops if listening. One control, one meaning. */
  toggle: (language: LanguageCode) => void;
  dismissError: () => void;
};

export type SpeechRecognitionCallbacks = {
  /** Interim text, replaced as the recogniser revises it. */
  onPartial: (transcript: string) => void;
  /** The settled transcript. */
  onFinal: (transcript: string) => void;
};

export function useSpeechRecognition(callbacks: SpeechRecognitionCallbacks): SpeechController {
  const [status, setStatus] = useState<SpeechStatus>('unavailable');
  const [error, setError] = useState<AppError | undefined>(undefined);

  /**
   * Refs, not state: `toggle` must see the true session state synchronously to
   * reject a second tap, and a state update is not visible until the next
   * render.
   */
  const busy = useRef(false);
  const mounted = useRef(true);

  /**
   * Kept in a ref so the event subscription never needs re-creating, and
   * updated in an effect rather than during render — a ref written while
   * rendering can be torn between a discarded render and the committed one.
   */
  const handlers = useRef(callbacks);
  useEffect(() => {
    handlers.current = callbacks;
  });

  useEffect(() => {
    mounted.current = true;

    if (!FEATURES.speechInput) return;

    void services.speech.isAvailable().then((can) => {
      if (mounted.current && can) setStatus('idle');
    });

    const unsubscribe = services.speech.subscribe((event) => {
      if (!mounted.current) return;

      switch (event.type) {
        case 'partial':
          handlers.current.onPartial(event.transcript);
          break;
        case 'final':
          handlers.current.onFinal(event.transcript);
          break;
        case 'error':
          busy.current = false;
          setError(event.error);
          setStatus(event.error.code === 'permission_denied' ? 'permission_denied' : 'error');
          break;
        case 'end':
          busy.current = false;
          // Errors set their own status; a normal end returns to idle.
          setStatus((current) => (current === 'listening' ? 'idle' : current));
          break;
        case 'volume':
          break;
      }
    });

    return () => {
      mounted.current = false;
      unsubscribe();
      // Leaving the screen must not leave the microphone open.
      void services.speech.cancel();
    };
  }, []);

  const toggle = useCallback((language: LanguageCode) => {
    // Rejects both a double start and a double stop.
    if (busy.current) {
      busy.current = false;
      setStatus('idle');
      void services.speech.stop();
      return;
    }

    busy.current = true;
    setError(undefined);
    setStatus('requesting_permission');

    void (async () => {
      const permitted = await services.speech.requestPermission();

      // Refused for good: only system settings can change it now.
      if (!permitted.ok) {
        busy.current = false;
        if (!mounted.current) return;
        setError(permitted.error);
        setStatus('permission_blocked');
        return;
      }

      // Refused this time; the dialog can be offered again on the next tap.
      if (!permitted.value) {
        busy.current = false;
        if (!mounted.current) return;
        setError(appError('permission_denied', 'Microphone access is needed to listen.'));
        setStatus('permission_denied');
        return;
      }

      const started = await services.speech.start({ language, interimResults: true });

      if (!mounted.current) return;
      if (started.ok) {
        setStatus('listening');
        return;
      }

      busy.current = false;
      setError(started.error);
      setStatus('error');
    })();
  }, []);

  return {
    status,
    listening: status === 'listening',
    error,
    toggle,
    dismissError: useCallback(() => setError(undefined), []),
  };
}
