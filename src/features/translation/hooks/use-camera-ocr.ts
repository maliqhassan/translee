import { useCallback, useEffect, useRef, useState } from 'react';

import { FEATURES } from '@/constants';
import { services } from '@/services';
import type { AppError } from '@/types';

/**
 * Scanning text with the camera, as the translate screen needs it.
 *
 * Owns the flow and the state a control renders from; the screen never sees
 * the camera or the recogniser. Opening the scanner is the only thing that can
 * ask for the camera permission, and it happens on a tap and nowhere else.
 *
 * Recognised text is handed to the caller and nothing else — not logged, and
 * not translated automatically. The user reads it, fixes anything the
 * recogniser misread, and presses Translate themselves, exactly as with typed
 * or dictated text.
 */

export type ScanStatus =
  /** No recogniser in this build, or the capability has not shipped. */
  | 'unavailable'
  | 'idle'
  /** The camera sheet is open and waiting for a capture. */
  | 'scanning'
  /** A capture is being read. */
  | 'recognizing'
  | 'error';

export type CameraOcrController = {
  status: ScanStatus;
  /** True while the camera sheet should be presented. */
  scanning: boolean;
  busy: boolean;
  error?: AppError;
  /** Opens the scanner. The only path to a camera permission request. */
  open: () => void;
  /** Closes the scanner without reading anything. */
  close: () => void;
  /** Called by the scanner with the captured file. */
  capture: (imageUri: string) => void;
  dismissError: () => void;
};

export function useCameraOcr(onText: (text: string) => void): CameraOcrController {
  const [status, setStatus] = useState<ScanStatus>('unavailable');
  const [error, setError] = useState<AppError | undefined>(undefined);

  const mounted = useRef(true);
  /** Rejects a second capture while one is still being read. */
  const reading = useRef(false);

  const handler = useRef(onText);
  useEffect(() => {
    handler.current = onText;
  });

  useEffect(() => {
    mounted.current = true;

    if (!FEATURES.cameraOcr) return;

    void services.ocr.isAvailable().then((can) => {
      if (mounted.current && can) setStatus('idle');
    });

    return () => {
      mounted.current = false;
    };
  }, []);

  const open = useCallback(() => {
    setError(undefined);
    // Guarded on the current status so a build without the recogniser can
    // never open a camera it has no use for.
    setStatus((current) => (current === 'unavailable' ? current : 'scanning'));
  }, []);

  const close = useCallback(() => {
    reading.current = false;
    setStatus((current) => (current === 'unavailable' ? current : 'idle'));
  }, []);

  const capture = useCallback((imageUri: string) => {
    if (reading.current) return;
    reading.current = true;
    setStatus('recognizing');

    void (async () => {
      const result = await services.ocr.recognize({ imageUri });
      reading.current = false;
      if (!mounted.current) return;

      if (!result.ok) {
        // A failed read leaves the draft exactly as it was: no stale text, no
        // half-recognised fragment, nothing invented.
        setError(result.error);
        setStatus('error');
        return;
      }

      handler.current(result.value.fullText);
      setStatus('idle');
    })();
  }, []);

  return {
    status,
    scanning: status === 'scanning' || status === 'recognizing',
    busy: status === 'recognizing',
    error,
    open,
    close,
    capture,
    dismissError: useCallback(() => {
      setError(undefined);
      setStatus((current) => (current === 'error' ? 'idle' : current));
    }, []),
  };
}
