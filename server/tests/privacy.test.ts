import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { describeConfig, loadConfig } from '../src/config';
import { createAzureProvider } from '../src/translation/azure-provider';

/**
 * What the backend is allowed to say out loud.
 *
 * The credential and the user's text are the two things that must never reach
 * a log line, a response body or an error. The provider adapter is already
 * tested for leaks; this covers the process around it.
 */

// Tests run from .test-build, so the compiled tree is not the source tree.
// cwd is the server package root when the suite runs.
const SRC = path.join(process.cwd(), 'src');

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (entry.name.endsWith('.ts')) found.push(full);
  }
  return found;
}

describe('nothing the user typed is ever logged', () => {
  it('logs only at boot, and only about configuration', () => {
    const files = sourceFiles(SRC);
    // A wrong path would make every assertion below vacuously true.
    assert.ok(files.length > 5, `expected real sources under ${SRC}`);

    const calls: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const call of source.match(/console\.\w+\([^)]*\)/g) ?? []) {
        calls.push(`${path.basename(file)}: ${call}`);
      }
    }

    // Every one of them must be free of the request payload. `text` is the
    // field that carries what the user typed.
    for (const call of calls) {
      assert.equal(/request\b|\.text\b|payload|body|translatedText/.test(call), false, call);
    }
  });

  it('keeps logging out of the translation path entirely', () => {
    // The handler, the contract and the provider run per request; none of them
    // may write anything at all.
    for (const file of [
      'translation/translate-handler.ts',
      'translation/contract.ts',
      'server.ts',
    ]) {
      const source = readFileSync(path.join(SRC, file), 'utf8');
      assert.equal(/console\./.test(source), false, file);
    }
  });
});

describe('the credential never escapes the process', () => {
  it('is reported as present or missing, never by value', () => {
    const summary = describeConfig(
      loadConfig({ TRANSLATION_PROVIDER_API_KEY: 'super-secret-value', PORT: '1234' }),
    );

    assert.match(summary, /credential=configured/);
    assert.equal(summary.includes('super-secret-value'), false);
  });

  it('says "missing" rather than inventing a value', () => {
    const summary = describeConfig(loadConfig({ TRANSLATION_PROVIDER: 'azure' }));
    assert.match(summary, /credential=missing/);
  });

  it('is never placed in the URL or the request body', async () => {
    let seenUrl = '';
    let seenBody = '';
    let seenHeaders: Record<string, string> = {};

    const provider = createAzureProvider({
      apiKey: 'super-secret-value',
      region: 'westeurope',
      timeoutMs: 1000,
      fetchImpl: (async (url: string, init: RequestInit) => {
        seenUrl = String(url);
        seenBody = String(init.body);
        seenHeaders = init.headers as Record<string, string>;
        return new Response(JSON.stringify([{ translations: [{ text: 'Hallo' }] }]), {
          status: 200,
        });
      }) as unknown as typeof fetch,
    });

    await provider.translate({ text: 'Hello', sourceCode: 'en', targetCode: 'de' });

    assert.equal(seenUrl.includes('super-secret-value'), false, 'never in the query string');
    assert.equal(seenBody.includes('super-secret-value'), false, 'never in the body');
    // It belongs in exactly one place.
    assert.equal(seenHeaders['Ocp-Apim-Subscription-Key'], 'super-secret-value');
    assert.equal(seenHeaders['Ocp-Apim-Subscription-Region'], 'westeurope');
  });

  it('sends no region header for a global resource', async () => {
    let seenHeaders: Record<string, string> = {};

    const provider = createAzureProvider({
      apiKey: 'k',
      timeoutMs: 1000,
      fetchImpl: (async (_url: string, init: RequestInit) => {
        seenHeaders = init.headers as Record<string, string>;
        return new Response(JSON.stringify([{ translations: [{ text: 'Hallo' }] }]), {
          status: 200,
        });
      }) as unknown as typeof fetch,
    });

    await provider.translate({ text: 'Hello', sourceCode: 'en', targetCode: 'de' });
    assert.equal('Ocp-Apim-Subscription-Region' in seenHeaders, false);
  });
});

describe('a custom endpoint is honoured', () => {
  it('calls the configured host instead of the global one', async () => {
    let seenUrl = '';

    const provider = createAzureProvider({
      apiKey: 'k',
      endpoint: 'https://transee-eu.cognitiveservices.azure.com/translate',
      timeoutMs: 1000,
      fetchImpl: (async (url: string) => {
        seenUrl = String(url);
        return new Response(JSON.stringify([{ translations: [{ text: 'Hallo' }] }]), {
          status: 200,
        });
      }) as unknown as typeof fetch,
    });

    await provider.translate({ text: 'Hello', sourceCode: 'en', targetCode: 'de' });

    assert.match(seenUrl, /transee-eu\.cognitiveservices\.azure\.com/);
    assert.match(seenUrl, /api-version=3\.0/);
  });

  it('is read from the environment', () => {
    const config = loadConfig({
      TRANSLATION_PROVIDER_API_KEY: 'k',
      TRANSLATION_PROVIDER_ENDPOINT: 'https://example.invalid/translate',
    });

    assert.equal(config.providerEndpoint, 'https://example.invalid/translate');
  });

  it('is undefined when unset, so the global endpoint is used', () => {
    assert.equal(loadConfig({ TRANSLATION_PROVIDER_API_KEY: 'k' }).providerEndpoint, undefined);
  });
});
