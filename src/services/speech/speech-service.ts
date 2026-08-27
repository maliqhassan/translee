import type { LanguageCode, Unsubscribe } from '@/types';

import type { Service, ServiceResult } from '../types';

export type SpeechRecognitionEvent =
  | { type: 'partial'; transcript: string }
  | { type: 'final'; transcript: string; detectedLanguage?: LanguageCode }
  | { type: 'volume'; level: number }
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
