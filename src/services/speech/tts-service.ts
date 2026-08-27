import type { LanguageCode, Unsubscribe } from '@/types';

import type { Service, ServiceResult } from '../types';

export type Voice = {
  id: string;
  name: string;
  language: LanguageCode;
};

export type SpeakOptions = {
  language: LanguageCode;
  voiceId?: string;
  /** 0.5–2.0, where 1 is the natural rate. */
  rate?: number;
  pitch?: number;
};

export type TTSEvent = { type: 'start' } | { type: 'done' } | { type: 'stopped' };

/** Text → speech, used for reading translations aloud. */
export type TTSService = Service & {
  speak(text: string, options: SpeakOptions): ServiceResult<void>;
  stop(): ServiceResult<void>;
  getVoices(language?: LanguageCode): ServiceResult<Voice[]>;
  subscribe(listener: (event: TTSEvent) => void): Unsubscribe;
};
