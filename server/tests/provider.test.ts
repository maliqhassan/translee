import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  adaptAzureResponse,
  adaptAzureStatus,
  createAzureProvider,
} from '../src/translation/azure-provider';
import { createFakeProvider } from '../src/translation/fake-provider';
import { createLanguageResolver, loadLanguageMap } from '../src/translation/language-map';
import { handleTranslate } from '../src/translation/translate-handler';

const languages = createLanguageResolver(loadLanguageMap());
const KEY = 'test-key-not-a-real-credential';

/** Builds an Azure provider whose transport is a scripted fake. */
function azureWith(
  respond: (url: string, init: RequestInit) => Response | Promise<Response>,
  options: { apiKey?: string } = { apiKey: KEY },
) {
  const apiKey = options.apiKey;
  const seen: { url: string; init: RequestInit }[] = [];
  const provider = createAzureProvider({
    apiKey,
    region: 'westeurope',
    timeoutMs: 500,
    fetchImpl: (async (url: string, init: RequestInit) => {
      seen.push({ url: String(url), init });
      return respond(String(url), init);
    }) as unknown as typeof fetch,
  });
  return { provider, seen };
}

const azureOk = (text: string, detected?: string) =>
  new Response(
    JSON.stringify([
      {
        ...(detected ? { detectedLanguage: { language: detected, score: 1 } } : {}),
        translations: [{ text, to: 'de' }],
      },
    ]),
    { status: 200 },
  );

describe('azure response adapter', () => {
  it('accepts a well-formed provider payload', () => {
    const result = adaptAzureResponse([{ translations: [{ text: 'Hallo', to: 'de' }] }]);
    assert.equal(result.ok && result.value.translatedText, 'Hallo');
  });

  it('carries a detected language through', () => {
    const result = adaptAzureResponse([
      { detectedLanguage: { language: 'en', score: 1 }, translations: [{ text: 'Hallo' }] },
    ]);
    assert.equal(result.ok && result.value.detectedCode, 'en');
  });

  it('rejects malformed provider payloads', () => {
    const malformed: unknown[] = [
      null,
      {},
      [],
      [null],
      ['string'],
      [{}],
      [{ translations: [] }],
      [{ translations: [{}] }],
      [{ translations: [{ text: 123 }] }],
      [{ translations: [{ text: '' }] }],
    ];
    for (const payload of malformed) {
      const result = adaptAzureResponse(payload);
      assert.equal(result.ok, false, `should reject ${JSON.stringify(payload)}`);
      assert.equal(!result.ok && result.error.code, 'provider_error');
    }
  });
});

describe('azure status mapping', () => {
  it('normalises provider statuses into our vocabulary', () => {
    assert.equal((adaptAzureStatus(429) as { error: { code: string } }).error.code, 'rate_limited');
    assert.equal(
      (adaptAzureStatus(500) as { error: { code: string } }).error.code,
      'provider_unavailable',
    );
    assert.equal(
      (adaptAzureStatus(503) as { error: { code: string } }).error.code,
      'provider_unavailable',
    );
    assert.equal(
      (adaptAzureStatus(400) as { error: { code: string } }).error.code,
      'unsupported_language',
    );
  });

  it('never tells a caller that the credential is the problem', () => {
    for (const status of [401, 403]) {
      const result = adaptAzureStatus(status) as { error: { code: string; message: string } };
      assert.equal(result.error.code, 'provider_unavailable');
      const message = result.error.message.toLowerCase();
      for (const leak of ['key', 'credential', 'auth', 'token', 'subscription', '401', '403']) {
        assert.ok(!message.includes(leak), `message must not mention "${leak}"`);
      }
    }
  });
});

describe('azure provider requests', () => {
  it('sends the credential as a header and never in the URL or body', async () => {
    const { provider, seen } = azureWith(() => azureOk('Hallo'));
    await provider.translate({ text: 'Hello', sourceCode: 'en', targetCode: 'de' });

    const call = seen[0];
    assert.ok(call);
    assert.ok(!call.url.includes(KEY), 'key must not appear in the URL');
    assert.ok(!String(call.init.body).includes(KEY), 'key must not appear in the body');

    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers['Ocp-Apim-Subscription-Key'], KEY);
    assert.equal(headers['Ocp-Apim-Subscription-Region'], 'westeurope');
  });

  it('omits `from` so the provider detects the source', async () => {
    const { provider, seen } = azureWith(() => azureOk('Hallo', 'en'));
    await provider.translate({ text: 'Hello', sourceCode: undefined, targetCode: 'de' });
    assert.ok(!seen[0]?.url.includes('from='), 'from must be omitted for auto-detect');
    assert.ok(seen[0]?.url.includes('to=de'));
  });

  it('reports unconfigured when no key is present', async () => {
    // Explicitly empty options, so the default key is not reinstated.
    const { provider } = azureWith(() => azureOk('Hallo'), {});
    assert.equal(provider.isConfigured(), false);
    const result = await provider.translate({ text: 'Hello', targetCode: 'de' });
    assert.equal(!result.ok && result.error.code, 'provider_unavailable');
  });

  it('normalises a provider 429', async () => {
    const { provider } = azureWith(() => new Response('{}', { status: 429 }));
    const result = await provider.translate({ text: 'Hello', targetCode: 'de' });
    assert.equal(!result.ok && result.error.code, 'rate_limited');
  });

  it('normalises a provider 5xx', async () => {
    const { provider } = azureWith(() => new Response('{}', { status: 503 }));
    const result = await provider.translate({ text: 'Hello', targetCode: 'de' });
    assert.equal(!result.ok && result.error.code, 'provider_unavailable');
  });

  it('normalises a network failure without leaking the cause', async () => {
    const { provider } = azureWith(() => {
      throw new TypeError(`fetch failed for https://api.example/translate?key=${KEY}`);
    });
    const result = await provider.translate({ text: 'Hello', targetCode: 'de' });
    assert.equal(!result.ok && result.error.code, 'provider_unavailable');
    assert.ok(!JSON.stringify(result).includes(KEY), 'thrown cause must not reach the caller');
  });

  it('normalises invalid provider JSON', async () => {
    const { provider } = azureWith(() => new Response('<html>nope</html>', { status: 200 }));
    const result = await provider.translate({ text: 'Hello', targetCode: 'de' });
    assert.equal(!result.ok && result.error.code, 'provider_error');
  });

  it('times out a provider that never answers', async () => {
    // Mirrors real fetch: a pending request rejects when its signal aborts.
    const { provider } = azureWith(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    const started = Date.now();
    const result = await provider.translate({ text: 'Hello', targetCode: 'de' });
    assert.equal(!result.ok && result.error.code, 'provider_unavailable');
    assert.ok(Date.now() - started < 3000, 'should not hang');
  });
});

describe('translate handler', () => {
  const withProvider = (
    respond: (url: string, init: RequestInit) => Response | Promise<Response>,
  ) =>
    handleTranslate(
      { sourceLanguage: 'en', targetLanguage: 'de', text: 'Hello' },
      { provider: azureWith(respond).provider, languages, maxTextLength: 5000 },
    );

  it('returns the normalised Transee response', async () => {
    const result = await withProvider(() => azureOk('Hallo'));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value, {
      translatedText: 'Hallo',
      sourceLanguage: 'en',
      targetLanguage: 'de',
    });
  });

  it('never leaks provider fields into the response', async () => {
    const result = await withProvider(
      () =>
        new Response(
          JSON.stringify([
            {
              translations: [{ text: 'Hallo', to: 'de', alignment: { proj: '0:4-0:4' } }],
              sourceText: { text: 'Hello' },
            },
          ]),
          { status: 200 },
        ),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(Object.keys(result.value).sort(), [
      'sourceLanguage',
      'targetLanguage',
      'translatedText',
    ]);
  });

  it('maps a detected provider code back to a LanguageId', async () => {
    const result = await handleTranslate(
      { sourceLanguage: 'auto', targetLanguage: 'de', text: 'Hello' },
      {
        provider: azureWith(() => azureOk('Hallo', 'en')).provider,
        languages,
        maxTextLength: 5000,
      },
    );
    assert.equal(result.ok && result.value.detectedLanguage, 'en');
  });

  it('omits detectedLanguage when the source was explicit', async () => {
    const result = await withProvider(() => azureOk('Hallo', 'en'));
    assert.equal(result.ok && 'detectedLanguage' in result.value, false);
  });

  it('rejects before calling the provider when validation fails', async () => {
    let called = false;
    const result = await handleTranslate(
      { sourceLanguage: 'en', targetLanguage: 'jv', text: 'Hello' },
      {
        provider: azureWith(() => {
          called = true;
          return azureOk('x');
        }).provider,
        languages,
        maxTextLength: 5000,
      },
    );
    assert.equal(!result.ok && result.error.code, 'unsupported_language');
    assert.equal(called, false, 'provider must not be contacted');
  });
});

describe('fake provider', () => {
  it('is always configured and visibly marks its output', async () => {
    const provider = createFakeProvider();
    assert.equal(provider.isConfigured(), true);
    const result = await provider.translate({ text: 'Hello', sourceCode: 'en', targetCode: 'de' });
    assert.equal(result.ok && result.value.translatedText, '[de] Hello');
  });
});
