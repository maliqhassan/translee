/**
 * Regenerates shared/provider-languages.json from the provider's live language
 * list.
 *
 * The provider decides which of our catalogue languages it can actually
 * translate, and that answer changes over time. Rather than hand-maintaining a
 * list that silently rots, this queries the provider and writes the mapping
 * both the app and the backend read.
 *
 * Azure's language endpoint needs no credential, so this is safe to run any
 * time: node scripts/sync-provider-languages.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(root, 'shared', 'provider-languages.json');
const LANGUAGES_URL =
  'https://api.cognitive.microsofttranslator.com/languages?api-version=3.0&scope=translation';

/**
 * Where our LanguageId and the provider's code legitimately differ.
 *
 * Azure's bare `pt` is Brazilian Portuguese, and it qualifies Serbian and
 * Mongolian by script. Our catalogue names the script in the endonym, so these
 * pick the matching one rather than letting the provider choose.
 */
const OVERRIDES = {
  'pt-BR': 'pt',
  'pt-PT': 'pt-PT',
  sr: 'sr-Cyrl',
  mn: 'mn-Cyrl',
};

/** Compiles the catalogue on its own; it has no runtime imports. */
function loadCatalogue() {
  const out = mkdtempSync(path.join(tmpdir(), 'transee-catalog-'));
  try {
    execFileSync(
      'npx',
      [
        'tsc',
        path.join('src', 'constants', 'language-catalog.ts'),
        '--ignoreConfig',
        '--outDir',
        out,
        '--module',
        'commonjs',
        '--target',
        'es2020',
        '--skipLibCheck',
      ],
      { cwd: root, stdio: 'pipe', shell: true },
    );
  } catch {
    // tsc reports the erased `@/types` import as unresolved but still emits.
  }
  return require(path.join(out, 'language-catalog.js')).LANGUAGE_CATALOG;
}

const response = await fetch(LANGUAGES_URL);
if (!response.ok) {
  console.error(`Provider language list failed: HTTP ${response.status}`);
  process.exit(1);
}

const providerLanguages = (await response.json()).translation;
const catalogue = loadCatalogue();

const languages = {};
const unsupported = [];

for (const language of catalogue) {
  const candidate =
    OVERRIDES[language.id] ??
    (language.id in providerLanguages
      ? language.id
      : language.code in providerLanguages
        ? language.code
        : undefined);

  if (candidate && candidate in providerLanguages) languages[language.id] = candidate;
  else unsupported.push(language.id);
}

const previous = (() => {
  try {
    return readFileSync(OUTPUT, 'utf8');
  } catch {
    return '';
  }
})();

const next =
  JSON.stringify(
    {
      $comment:
        'GENERATED FILE - do not edit by hand. Regenerate with: node scripts/sync-provider-languages.mjs',
      provider: 'azure-translator',
      source: LANGUAGES_URL,
      autoDetectId: 'auto',
      unsupported,
      languages,
    },
    null,
    2,
  ) + '\n';

writeFileSync(OUTPUT, next);

console.log(`provider languages: ${Object.keys(providerLanguages).length}`);
console.log(`catalogue: ${catalogue.length}  supported: ${Object.keys(languages).length}`);
console.log(`unsupported: ${unsupported.length ? unsupported.join(', ') : 'none'}`);
console.log(previous === next ? 'no change' : `updated ${path.relative(root, OUTPUT)}`);
