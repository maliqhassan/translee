import { err, notImplemented } from '@/utils';

import type { ServiceResult } from '../types';

import type { SpeechService } from './speech-service';
import type { TTSService, Voice } from './tts-service';

export * from './speech-service';
export * from './tts-service';

const noop = () => {};

/** Placeholder. Wired up on the voice-input day. */
export const speechService: SpeechService = {
  id: 'speech',
  async isAvailable() {
    return false;
  },
  requestPermission: () => Promise.resolve(err(notImplemented('Microphone permission'))),
  start: () => Promise.resolve(err(notImplemented('Speech recognition'))),
  stop: () => Promise.resolve(err(notImplemented('Speech recognition'))),
  cancel: () => Promise.resolve(err(notImplemented('Speech recognition'))),
  subscribe: () => noop,
};

/** Placeholder. Wired up on the text-to-speech day. */
export const ttsService: TTSService = {
  id: 'tts',
  async isAvailable() {
    return false;
  },
  speak: () => Promise.resolve(err(notImplemented('Text to speech'))),
  stop: () => Promise.resolve(err(notImplemented('Text to speech'))),
  getVoices: (): ServiceResult<Voice[]> =>
    Promise.resolve(err(notImplemented('Voice enumeration'))),
  subscribe: () => noop,
};
