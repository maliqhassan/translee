import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import type * as Speech from 'expo-speech';

import { createExpoTTSService } from '@/services/speech/expo-tts-service';
import type { TTSEvent } from '@/services/speech/tts-service';

/**
 * Day 15: reading a translation aloud.
 *
 * The platform speech engine cannot run under Node, so the service is driven
 * against a fake with expo-speech's exact shape — fire-and-forget `speak` whose
 * outcomes arrive as callbacks. That covers every line of our own code; it does
 * not and cannot cover whether a real device actually produces sound.
 */

type SpeakCall = { text: string; options: Record<string, unknown> };

/** A stand-in for expo-speech, with its API and its callback behaviour. */
function fakeSpeech(
  options: {
    voices?: { identifier: string; language: string; name: string }[];
    /** What the engine does with an utterance: finish, be stopped, or fail. */
    outcome?: 'done' | 'stopped' | 'error' | 'hang';
    throwOnSpeak?: boolean;
    failVoices?: boolean;
    maxLength?: number;
  } = {},
) {
  const calls: SpeakCall[] = [];
  const outcome = options.outcome ?? 'done';

  return {
    calls,
    stopped: 0,
    maxSpeechInputLength: options.maxLength ?? 4000,

    speak(text: string, opts: Record<string, unknown> = {}) {
      calls.push({ text, options: opts });
      if (options.throwOnSpeak) throw new Error('engine refused');

      const on = (name: string) => opts[name] as ((arg?: unknown) => void) | undefined;
      on('onStart')?.();

      // Callbacks arrive asynchronously on a real engine.
      queueMicrotask(() => {
        if (outcome === 'done') on('onDone')?.();
        if (outcome === 'stopped') on('onStopped')?.();
        if (outcome === 'error') on('onError')?.(new Error('boom'));
      });
    },

    async stop(this: { stopped: number }) {
      this.stopped += 1;
    },

    async getAvailableVoicesAsync() {
      if (options.failVoices) throw new Error('no engine');
      return (
        options.voices ?? [
          { identifier: 'en-1', language: 'en-GB', name: 'Daniel' },
          { identifier: 'en-2', language: 'en_US', name: 'Samantha' },
          { identifier: 'de-1', language: 'de-DE', name: 'Anna' },
        ]
      );
    },

    async isSpeakingAsync() {
      return false;
    },
  } as unknown as typeof Speech & { calls: SpeakCall[]; stopped: number };
}

const service = (speech: ReturnType<typeof fakeSpeech>) => createExpoTTSService(speech);

describe('whether the device can speak at all', () => {
  it('is available when the engine reports voices', async () => {
    assert.equal(await service(fakeSpeech()).isAvailable(), true);
  });

  it('is unavailable when no voice is installed', async () => {
    // A device with no TTS engine must not light up a button that does nothing.
    assert.equal(await service(fakeSpeech({ voices: [] })).isAvailable(), false);
  });

  it('is unavailable rather than throwing when the engine cannot be reached', async () => {
    assert.equal(await service(fakeSpeech({ failVoices: true })).isAvailable(), false);
  });
});

describe('speaking a translation', () => {
  it('passes the text and language straight to the engine', async () => {
    const speech = fakeSpeech();
    const result = await service(speech).speak('Hallo Welt', { language: 'de' });

    assert.equal(result.ok, true);
    assert.equal(speech.calls[0]?.text, 'Hallo Welt');
    assert.equal(speech.calls[0]?.options.language, 'de');
  });

  it('passes a script variant through unchanged, inventing no mapping', async () => {
    // Our LanguageIds are already BCP-47 tags, which is what the platform wants.
    const speech = fakeSpeech();
    await service(speech).speak('你好', { language: 'zh-Hans' });

    assert.equal(speech.calls[0]?.options.language, 'zh-Hans');
  });

  it('resolves when the utterance finishes', async () => {
    const result = await service(fakeSpeech({ outcome: 'done' })).speak('Hi', { language: 'en' });
    assert.equal(result.ok, true);
  });

  it('treats being stopped as a normal outcome, not a failure', async () => {
    // The user asked for it; an error banner would be wrong.
    const result = await service(fakeSpeech({ outcome: 'stopped' })).speak('Hi', {
      language: 'en',
    });
    assert.equal(result.ok, true);
  });

  it('reports an engine error without leaking its message', async () => {
    const result = await service(fakeSpeech({ outcome: 'error' })).speak('Hi', { language: 'en' });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, 'unknown');
    assert.equal(!result.ok && result.error.message.includes('boom'), false);
  });

  it('survives an engine that throws on the call itself', async () => {
    const result = await service(fakeSpeech({ throwOnSpeak: true })).speak('Hi', {
      language: 'en',
    });
    assert.equal(result.ok, false);
  });

  it('refuses empty text rather than calling the engine', async () => {
    const speech = fakeSpeech();
    const result = await service(speech).speak('   ', { language: 'en' });

    assert.equal(!result.ok && result.error.code, 'invalid_request');
    assert.equal(speech.calls.length, 0);
  });

  it('refuses text longer than the platform accepts', async () => {
    const speech = fakeSpeech({ maxLength: 10 });
    const result = await service(speech).speak('a'.repeat(11), { language: 'en' });

    assert.equal(!result.ok && result.error.code, 'invalid_request');
    assert.equal(speech.calls.length, 0, 'the platform would have rejected it anyway');
  });

  it('refuses to speak an auto source rather than guessing a voice', async () => {
    const speech = fakeSpeech();
    const result = await service(speech).speak('Hello', { language: 'auto' });

    assert.equal(!result.ok && result.error.code, 'unsupported_language');
    assert.equal(speech.calls.length, 0);
  });

  it('settles exactly once even if the engine calls back twice', async () => {
    const speech = fakeSpeech();
    let settled = 0;

    const promise = service(speech).speak('Hi', { language: 'en' });
    void promise.then(() => (settled += 1));
    await promise;
    await new Promise((r) => setTimeout(r, 5));

    assert.equal(settled, 1);
  });
});

describe('reporting what it is doing', () => {
  it('emits start and done around an utterance', async () => {
    const events: TTSEvent[] = [];
    const tts = service(fakeSpeech());
    tts.subscribe((event) => events.push(event));

    await tts.speak('Hi', { language: 'en' });

    assert.deepEqual(
      events.map((event) => event.type),
      ['start', 'done'],
    );
  });

  it('emits stopped when the utterance is interrupted', async () => {
    const events: TTSEvent[] = [];
    const tts = service(fakeSpeech({ outcome: 'stopped' }));
    tts.subscribe((event) => events.push(event));

    await tts.speak('Hi', { language: 'en' });

    assert.ok(events.some((event) => event.type === 'stopped'));
  });

  it('stops notifying after unsubscribe', async () => {
    const events: TTSEvent[] = [];
    const tts = service(fakeSpeech());
    const unsubscribe = tts.subscribe((event) => events.push(event));

    unsubscribe();
    await tts.speak('Hi', { language: 'en' });

    assert.deepEqual(events, []);
  });

  it('stops speech through the engine', async () => {
    const speech = fakeSpeech();
    const result = await service(speech).stop();

    assert.equal(result.ok, true);
    assert.equal(speech.stopped, 1);
  });
});

describe('choosing a voice', () => {
  it('lists every voice the engine offers', async () => {
    const voices = await service(fakeSpeech()).getVoices();

    assert.equal(voices.ok, true);
    assert.equal(voices.ok && voices.value.length, 3);
    assert.equal(voices.ok && voices.value[0]?.id, 'en-1');
  });

  it('filters by base language across both separators', async () => {
    // Platforms report en-GB and en_US; both are English.
    const voices = await service(fakeSpeech()).getVoices('en');

    assert.equal(voices.ok && voices.value.length, 2);
    assert.ok(
      voices.ok && voices.value.every((voice) => voice.language.toLowerCase().startsWith('en')),
    );
  });

  it('returns an empty list, not an error, for a language with no voice', async () => {
    const voices = await service(fakeSpeech()).getVoices('ja');
    assert.deepEqual(voices.ok ? voices.value : null, []);
  });

  it('reports a failure to enumerate rather than pretending there are none', async () => {
    const voices = await service(fakeSpeech({ failVoices: true })).getVoices();

    assert.equal(voices.ok, false);
    assert.equal(!voices.ok && voices.error.code, 'service_unavailable');
  });
});

describe('the wiring around it', () => {
  it('is the only file importing expo-speech', () => {
    // Same rule as expo-clipboard and expo-sqlite: one file owns the platform API.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry.name) && readFileSync(path, 'utf8').includes('expo-speech')) {
          offenders.push(path);
        }
      }
    };
    walk('src');

    assert.deepEqual(offenders, ['src/services/speech/expo-tts-service.ts']);
  });

  it('is bound in the registry, not imported by a screen', () => {
    const registry = readFileSync('src/services/service-registry.ts', 'utf8');
    assert.match(registry, /tts: expoTTSService/);
  });

  it('never logs the text it is given', () => {
    const source = readFileSync('src/services/speech/expo-tts-service.ts', 'utf8');

    // The text is the user's translation. No log call may take it.
    for (const line of source.split('\n')) {
      if (/log\.(warn|error|info|debug)/.test(line)) {
        assert.equal(/\btext\b|\btrimmed\b/.test(line), false, `log leaks text: ${line.trim()}`);
      }
    }
  });

  it('gates the control on the shipped-capability flag', () => {
    const hook = readFileSync('src/features/translation/hooks/use-speak.ts', 'utf8');
    assert.match(hook, /FEATURES\.textToSpeech/);
  });

  it('hides the listen button when the device cannot speak', () => {
    const card = readFileSync(
      'src/features/translation/components/translation-result-card.tsx',
      'utf8',
    );

    assert.match(card, /speak\?\.available/);
    // The Day 1 placeholder was a permanently disabled button; it is gone.
    assert.equal(
      /accessibilityLabel="Read the translation aloud"\s*\n\s*disabled/.test(card),
      false,
    );
  });
});
