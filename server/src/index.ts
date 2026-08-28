import { createServer } from 'node:http';

import { describeConfig, loadConfig } from './config';
import { createRequestHandler } from './server';
import { createAzureProvider } from './translation/azure-provider';
import { createFakeProvider } from './translation/fake-provider';
import { createLanguageResolver, loadLanguageMap } from './translation/language-map';
import type { TranslationProvider } from './translation/provider';

/**
 * Boots the Transee translation backend.
 *
 * The one place a concrete provider is chosen. Everything downstream depends
 * on the `TranslationProvider` interface, never on Azure.
 */

const config = loadConfig();
const languages = createLanguageResolver(loadLanguageMap());

function selectProvider(): TranslationProvider {
  if (config.provider === 'fake') return createFakeProvider();

  const azure = createAzureProvider({
    apiKey: config.providerApiKey,
    region: config.providerRegion,
    timeoutMs: config.providerTimeoutMs,
  });

  if (!azure.isConfigured()) {
    // Refusing to start is better than serving 503s that look like an outage.
    console.error(
      'TRANSLATION_PROVIDER_API_KEY is not set. Set it, or run with TRANSLATION_PROVIDER=fake for local development.',
    );
    process.exit(1);
  }

  return azure;
}

const provider = selectProvider();
const handler = createRequestHandler({ config, provider, languages });

const server = createServer((request, response) => {
  void handler(request, response).catch(() => {
    // A handler should never throw; if it does, fail closed and say nothing
    // that could describe the internals.
    if (!response.headersSent) {
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    response.end(
      JSON.stringify({ error: { code: 'internal_error', message: 'Unexpected error.' } }),
    );
  });
});

server.listen(config.port, () => {
  console.log(`Transee backend listening on :${config.port}`);
  console.log(describeConfig(config));
  console.log(`languages: ${languages.supportedIds().length} supported`);
});
