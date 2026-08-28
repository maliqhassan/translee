import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Maps Transee LanguageIds onto provider language codes.
 *
 * Day 3 separated the two on purpose: `zh-Hans` and `zh-Hant` are distinct
 * application identities that a provider may express differently, and
 * `pt-BR` is just `pt` to Azure. Translating between the two vocabularies is
 * this module's only job, and it happens server-side so the app never has to
 * know a provider's spelling.
 *
 * The table is generated from the provider's own language endpoint by
 * `scripts/sync-provider-languages.mjs` and shared with the app, so both sides
 * agree on what is supported.
 */

export type LanguageMap = {
  provider: string;
  autoDetectId: string;
  /** LanguageIds the catalogue has but the provider cannot translate. */
  unsupported: readonly string[];
  languages: Readonly<Record<string, string>>;
};

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

/** Validates the generated file rather than trusting it to be well-formed. */
export function parseLanguageMap(payload: unknown): LanguageMap {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('provider-languages.json is not an object');
  }

  const record = payload as Record<string, unknown>;
  if (!isRecordOfStrings(record.languages)) {
    throw new Error('provider-languages.json has no valid "languages" map');
  }
  if (Object.keys(record.languages).length === 0) {
    throw new Error('provider-languages.json contains no languages');
  }

  return {
    provider: typeof record.provider === 'string' ? record.provider : 'unknown',
    autoDetectId: typeof record.autoDetectId === 'string' ? record.autoDetectId : 'auto',
    unsupported: Array.isArray(record.unsupported)
      ? record.unsupported.filter((entry): entry is string => typeof entry === 'string')
      : [],
    languages: record.languages,
  };
}

const RELATIVE_PATH = path.join('shared', 'provider-languages.json');

/**
 * Walks up from the compiled file to find the shared mapping.
 *
 * The depth differs between `dist/` and the test build, so searching upward is
 * more robust than counting `..` segments and silently breaking when the
 * output layout changes.
 */
function findLanguageMapFile(startDir: string = __dirname): string {
  let directory = startDir;

  for (;;) {
    const candidate = path.join(directory, RELATIVE_PATH);
    if (existsSync(candidate)) return candidate;

    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error(`Could not locate ${RELATIVE_PATH} above ${startDir}`);
    }
    directory = parent;
  }
}

export function loadLanguageMap(filePath: string = findLanguageMapFile()): LanguageMap {
  return parseLanguageMap(JSON.parse(readFileSync(filePath, 'utf8')) as unknown);
}

export type LanguageResolver = {
  /** Whether a LanguageId can be routed to the provider. */
  isSupported(languageId: string): boolean;
  /** Provider code for a LanguageId, or undefined if unsupported. */
  toProviderCode(languageId: string): string | undefined;
  supportedIds(): readonly string[];
  readonly provider: string;
};

export function createLanguageResolver(map: LanguageMap): LanguageResolver {
  return {
    provider: map.provider,
    isSupported: (languageId) =>
      languageId === map.autoDetectId ||
      Object.prototype.hasOwnProperty.call(map.languages, languageId),
    toProviderCode: (languageId) =>
      languageId === map.autoDetectId ? undefined : map.languages[languageId],
    supportedIds: () => Object.keys(map.languages),
  };
}
