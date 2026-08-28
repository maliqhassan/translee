import * as SQLite from 'expo-sqlite';

import { appError, createLogger, err, ok } from '@/utils';

import type { Database } from './database';
import { runMigrations } from './migration-runner';

const log = createLogger('database');

/** The on-device file name. Changing it orphans existing history. */
export const DATABASE_NAME = 'transee.db';

/**
 * The only file in the app that imports expo-sqlite.
 *
 * Everything above it depends on the `Database` interface, which is what lets
 * the test suite run the very same repository SQL against Node's built-in
 * SQLite instead of a native module.
 *
 * No method here throws: driver failures become `storage_error`, and the
 * message never carries row data, because rows contain what the user typed.
 */
export function createExpoSQLiteDatabase(databaseName: string = DATABASE_NAME): Database {
  let handle: SQLite.SQLiteDatabase | null = null;

  /** Guards against use before `open`, rather than dereferencing null. */
  function requireHandle() {
    if (!handle) {
      return err(appError('storage_error', 'The database is not open.'));
    }
    return ok(handle);
  }

  return {
    async open() {
      if (handle) return ok(undefined);
      try {
        handle = await SQLite.openDatabaseAsync(databaseName);
        // Write-ahead logging keeps reads from blocking behind a write, which
        // matters because history is read on screens while a translation
        // completes in the background.
        await handle.execAsync('PRAGMA journal_mode = WAL;');
        return ok(undefined);
      } catch (cause) {
        log.error('could not open the database', cause);
        return err(appError('storage_error', 'The local database could not be opened.', cause));
      }
    },

    async close() {
      try {
        await handle?.closeAsync();
      } catch (cause) {
        log.warn('could not close the database cleanly', cause);
      } finally {
        handle = null;
      }
    },

    async migrate() {
      const database = requireHandle();
      if (!database.ok) return database;
      const outcome = await runMigrations(this);
      return outcome.ok ? ok(undefined) : err(outcome.error);
    },

    async select<T>(sql: string, params: readonly unknown[] = []) {
      const database = requireHandle();
      if (!database.ok) return database;
      try {
        return ok(await database.value.getAllAsync<T>(sql, params as SQLite.SQLiteBindValue[]));
      } catch (cause) {
        // The SQL is logged; the parameters are not, because they can be
        // whatever the user typed.
        log.error(`query failed: ${sql}`);
        return err(appError('storage_error', 'A database query failed.', cause));
      }
    },

    async execute(sql: string, params: readonly unknown[] = []) {
      const database = requireHandle();
      if (!database.ok) return database;
      try {
        await database.value.runAsync(sql, params as SQLite.SQLiteBindValue[]);
        return ok(undefined);
      } catch (cause) {
        log.error(`statement failed: ${sql}`);
        return err(appError('storage_error', 'A database write failed.', cause));
      }
    },

    async transaction(work: (tx: Database) => Promise<void>) {
      const database = requireHandle();
      if (!database.ok) return database;
      try {
        await database.value.withTransactionAsync(async () => {
          await work(this);
        });
        return ok(undefined);
      } catch (cause) {
        log.error('transaction rolled back');
        return err(appError('storage_error', 'A database transaction failed.', cause));
      }
    },
  };
}
