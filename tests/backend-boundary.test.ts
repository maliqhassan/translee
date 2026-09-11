import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { TRANSLATION_CONFIG, hasBackendConfigured } from '@/constants/translation-config';

/**
 * The line between the app and the provider.
 *
 * The app talks to the Transee backend and knows nothing else: not Azure's
 * host, not its headers, and above all not its key. Every `EXPO_PUBLIC_*`
 * value is inlined into the bundle at build time and is readable by anyone
 * holding the APK, so the only one allowed is the public backend URL.
 */

function appSources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) appSources(path, found);
    else if (/\.tsx?$/.test(entry.name)) found.push(path);
  }
  return found;
}

const SOURCES = [...appSources('src'), ...appSources('app'), ...appSources('modules')];

describe('the app never learns the provider credential', () => {
  it('contains no Azure authentication header anywhere', () => {
    for (const path of SOURCES) {
      const source = readFileSync(path, 'utf8');
      for (const header of ['Ocp-Apim-Subscription-Key', 'Ocp-Apim-Subscription-Region']) {
        assert.equal(source.includes(header), false, `${path} references ${header}`);
      }
    }
  });

  it('never calls the provider directly', () => {
    // The catalogue records where its data came from, which is a public,
    // keyless documentation URL. Calling the translate endpoint is the thing
    // that must not happen.
    for (const path of SOURCES) {
      const source = readFileSync(path, 'utf8');
      assert.equal(
        /cognitive\.microsofttranslator\.com\/translate/.test(source),
        false,
        `${path} calls the provider directly`,
      );
    }
  });

  it('reads exactly one public variable, and it is the backend URL', () => {
    const used = new Set<string>();

    for (const path of SOURCES) {
      for (const match of readFileSync(path, 'utf8').matchAll(/EXPO_PUBLIC_[A-Z0-9_]+/g)) {
        used.add(match[0]);
      }
    }

    assert.deepEqual([...used], ['EXPO_PUBLIC_TRANSEE_API_URL']);
  });

  it('carries nothing credential-shaped in its translation configuration', () => {
    const serialised = JSON.stringify(TRANSLATION_CONFIG).toLowerCase();

    for (const forbidden of ['key', 'secret', 'token', 'password', 'authorization', 'azure']) {
      assert.equal(serialised.includes(forbidden), false, forbidden);
    }
  });
});

describe('the backend URL is the app’s only address for translation', () => {
  it('points at a Transee host, never a provider one, when set', () => {
    const url = TRANSLATION_CONFIG.backend.baseUrl;

    if (url !== undefined) {
      assert.equal(/cognitive|microsofttranslator|azure/i.test(url), false);
    }
  });

  it('appends the Transee path, matching the backend route', () => {
    assert.equal(TRANSLATION_CONFIG.backend.translatePath, '/translation');
  });

  it('treats an unset variable as no backend rather than a default one', () => {
    // A guessed fallback URL would send every user's text to whatever happens
    // to answer there.
    assert.equal(hasBackendConfigured(), TRANSLATION_CONFIG.backend.baseUrl !== undefined);
  });

  it('is documented for deployment without a real value in the repo', () => {
    const example = readFileSync('.env.example', 'utf8');

    assert.match(example, /EXPO_PUBLIC_TRANSEE_API_URL=\s*$/m, 'placeholder must stay empty');
    assert.match(example, /never/i, 'it must say the provider key does not belong here');
  });
});

describe('the backend keeps its own secret out of the repository', () => {
  it('ships an example file with empty placeholders only', () => {
    const example = readFileSync('server/.env.example', 'utf8');

    for (const key of [
      'TRANSLATION_PROVIDER_API_KEY',
      'TRANSLATION_PROVIDER_REGION',
      'TRANSLATION_PROVIDER_ENDPOINT',
    ]) {
      assert.match(example, new RegExp(`^${key}=\\s*$`, 'm'), `${key} must be present and empty`);
    }
  });

  it('ignores real env files', () => {
    const ignored = readFileSync('server/.gitignore', 'utf8');

    assert.match(ignored, /^\.env$/m);
    assert.match(ignored, /^!\.env\.example$/m);
  });
});
