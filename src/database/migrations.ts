import { TABLES } from './schema';

export type Migration = {
  /** Monotonic. Never renumber or edit a shipped migration — append instead. */
  version: number;
  name: string;
  statements: readonly string[];
};

/** Bump as migrations are appended; the runner compares against `user_version`. */
export const LATEST_SCHEMA_VERSION = 2;

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS ${TABLES.translations} (
        id TEXT PRIMARY KEY NOT NULL,
        source_text TEXT NOT NULL,
        translated_text TEXT NOT NULL,
        source_language TEXT NOT NULL,
        detected_language TEXT,
        target_language TEXT NOT NULL,
        engine TEXT NOT NULL,
        origin TEXT NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_translations_created_at
        ON ${TABLES.translations} (created_at DESC);`,
      `CREATE TABLE IF NOT EXISTS ${TABLES.languagePacks} (
        id TEXT PRIMARY KEY NOT NULL,
        source_language TEXT NOT NULL,
        target_language TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        installed_at INTEGER
      );`,
      `CREATE TABLE IF NOT EXISTS ${TABLES.preferences} (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );`,
    ],
  },
  {
    version: 2,
    name: 'favourite_history_index',
    statements: [
      // Favourites are listed newest-first, so the index carries the sort with
      // it and SQLite never has to sort the filtered rows.
      `CREATE INDEX IF NOT EXISTS idx_translations_favourite
        ON ${TABLES.translations} (is_favorite, created_at DESC);`,
    ],
  },
];
