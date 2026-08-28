import { appError, createLogger, err, ok } from '@/utils';

import type { Database } from './database';
import { LATEST_SCHEMA_VERSION, MIGRATIONS, type Migration } from './migrations';

const log = createLogger('database.migrations');

/**
 * Applies pending migrations, using SQLite's own `user_version` as the record
 * of what has already run.
 *
 * Storing the version in the database file rather than a table of our own means
 * there is no bootstrap problem — no migration is needed to create the place
 * migrations are tracked — and the value travels with the file if it is copied
 * or restored from a backup.
 *
 * Running this is idempotent: a database already at the latest version does no
 * work, and every migration is written with `IF NOT EXISTS` so a partially
 * applied version is safe to replay.
 */

export type MigrationOutcome = {
  from: number;
  to: number;
  /** Versions actually executed this run. Empty when already up to date. */
  applied: readonly number[];
};

/** Migrations above `currentVersion`, in ascending order. */
export function pendingMigrations(
  currentVersion: number,
  migrations: readonly Migration[] = MIGRATIONS,
): readonly Migration[] {
  return [...migrations]
    .filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version);
}

async function readUserVersion(database: Database) {
  const result = await database.select<{ user_version: number }>('PRAGMA user_version;');
  if (!result.ok) return result;
  const version = result.value[0]?.user_version;
  return ok(typeof version === 'number' ? version : 0);
}

export async function runMigrations(
  database: Database,
  migrations: readonly Migration[] = MIGRATIONS,
) {
  const current = await readUserVersion(database);
  if (!current.ok) return current;

  const pending = pendingMigrations(current.value, migrations);

  if (pending.length === 0) {
    return ok<MigrationOutcome>({ from: current.value, to: current.value, applied: [] });
  }

  const applied: number[] = [];

  for (const migration of pending) {
    for (const statement of migration.statements) {
      const executed = await database.execute(statement);
      if (!executed.ok) {
        log.error(`migration ${migration.version} (${migration.name}) failed`);
        return err(
          appError(
            'storage_error',
            `Migration ${migration.version} (${migration.name}) failed.`,
            executed.error,
          ),
        );
      }
    }

    // `user_version` takes no parameters, so the value is written directly.
    // It comes from our own migration list, never from user input.
    const stamped = await database.execute(`PRAGMA user_version = ${migration.version};`);
    if (!stamped.ok) {
      return err(
        appError(
          'storage_error',
          `Could not record migration ${migration.version}.`,
          stamped.error,
        ),
      );
    }

    applied.push(migration.version);
    log.info(`applied migration ${migration.version} (${migration.name})`);
  }

  const highest = applied[applied.length - 1] ?? current.value;
  return ok<MigrationOutcome>({ from: current.value, to: highest, applied });
}

/** Whether a database is already at the version this build expects. */
export async function isUpToDate(database: Database) {
  const current = await readUserVersion(database);
  if (!current.ok) return current;
  return ok(current.value >= LATEST_SCHEMA_VERSION);
}
