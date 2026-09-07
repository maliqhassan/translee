import type { AppError, LanguageCode, Unsubscribe } from '@/types';

import type { Service, ServiceResult } from '../types';

export type SpeechRecognitionEvent =
  | { type: 'partial'; transcript: string }
  | { type: 'final'; transcript: string; detectedLanguage?: LanguageCode }
  | { type: 'volume'; level: number }
  /**
   * Recognition failed after it had started.
   *
   * Distinct from `start` returning an error: that is "we could not begin",
   * this is "we began and it went wrong". A screen needs both, and the Day 1
   * contract could only express the first.
   */
  | { type: 'error'; error: AppError }
  | { type: 'end' };

export type SpeechRecognitionOptions = {
  language: LanguageCode;
  /** Emit partial transcripts while the user is still speaking. */
  interimResults?: boolean;
  /** Auto-stop after this much silence. */
  silenceTimeoutMs?: number;
};

/** Microphone → text. */
export type SpeechService = Service & {
  requestPermission(): ServiceResult<boolean>;
  start(options: SpeechRecognitionOptions): ServiceResult<void>;
  stop(): ServiceResult<void>;
  cancel(): ServiceResult<void>;
  /** Subscribe before calling `start`. */
  subscribe(listener: (event: SpeechRecognitionEvent) => void): Unsubscribe;
};
