import { err, notImplemented } from '@/utils';

import type { SpeechService } from './speech-service';

export * from './expo-tts-service';
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
