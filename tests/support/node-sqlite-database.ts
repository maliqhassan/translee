import { DatabaseSync } from 'node:sqlite';

import type { Database } from '@/database';
import { appError, err, ok } from '@/utils';

/**
 * The `Database` seam, backed by Node's built-in SQLite.
 *
 * This exists so the tests run the *real* repository SQL against a real SQLite
 * engine. expo-sqlite is a native module and cannot load under Node, but the
 * Day 1 `Database` interface was built precisely so the driver is swappable —
 * so the only thing faked here is the driver, never the repository.
 *
 * Test-only: it lives outside `src/` and is never bundled into the app.
 */
export function createNodeSQLiteDatabase(filename = ':memory:'): Database {
  let handle: DatabaseSync | null = null;

  function requireHandle() {
    if (!handle) return err(appError('storage_error', 'The database is not open.'));
    return ok(handle);
  }

  const self: Database = {
    async open() {
      if (handle) return ok(undefined);
      try {
        handle = new DatabaseSync(filename);
        return ok(undefined);
      } catch (cause) {
        return err(appError('storage_error', 'The database could not be opened.', cause));
      }
    },

    async close() {
      handle?.close();
      handle = null;
    },

    async migrate() {
      const database = requireHandle();
      if (!database.ok) return database;
      // Imported lazily so this module stays a driver and nothing more.
      const { runMigrations } = await import('@/database');
      const outcome = await runMigrations(self);
      return outcome.ok ? ok(undefined) : err(outcome.error);
    },

    async select<T>(sql: string, params: readonly unknown[] = []) {
      const database = requireHandle();
      if (!database.ok) return database;
      try {
        const rows = database.value.prepare(sql).all(...(params as never[]));
        // node:sqlite returns null-prototype objects; normalise them so the
        // mapping layer sees ordinary records.
        return ok(rows.map((row) => ({ ...row }) as T));
      } catch (cause) {
        return err(appError('storage_error', 'A database query failed.', cause));
      }
    },

    async execute(sql: string, params: readonly unknown[] = []) {
      const database = requireHandle();
      if (!database.ok) return database;
      try {
        if (params.length === 0) database.value.exec(sql);
        else database.value.prepare(sql).run(...(params as never[]));
        return ok(undefined);
      } catch (cause) {
        return err(appError('storage_error', 'A database write failed.', cause));
      }
    },

    async transaction(work: (tx: Database) => Promise<void>) {
      const database = requireHandle();
      if (!database.ok) return database;
      try {
        database.value.exec('BEGIN');
        await work(self);
        database.value.exec('COMMIT');
        return ok(undefined);
      } catch (cause) {
        try {
          database.value.exec('ROLLBACK');
        } catch {
          // Already rolled back or never started.
        }
        return err(appError('storage_error', 'A database transaction failed.', cause));
      }
    },
  };

  return self;
}
