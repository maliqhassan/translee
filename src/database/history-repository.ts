import type { ServiceResult } from '@/services';
import type { HistoryEntry, TranslationResult, Unsubscribe } from '@/types';
import { appError, createId, err, ok } from '@/utils';

import type { Database } from './database';
import { toHistoryEntries, toHistoryEntry, toTranslationRow } from './history-mapping';
import { TABLES } from './schema';

/**
 * Persistent translation history.
 *
 * The only place SQL for history lives. Features depend on this interface and
 * never see a driver, a row or a statement.
 */

export type HistoryPage = {
  /** Newest first. */
  limit?: number;
  offset?: number;
};

export type HistoryRepository = {
  /** Opens the database and applies pending migrations. Safe to call twice. */
  initialize(): ServiceResult<void>;
  /** Whether history queries can run right now. */
  isReady(): boolean;

  create(result: TranslationResult): ServiceResult<HistoryEntry>;
  getById(id: string): ServiceResult<HistoryEntry | null>;
  listRecent(page?: HistoryPage): ServiceResult<HistoryEntry[]>;
  listFavorites(page?: HistoryPage): ServiceResult<HistoryEntry[]>;
  search(query: string, page?: HistoryPage): ServiceResult<HistoryEntry[]>;
  setFavorite(id: string, isFavorite: boolean): ServiceResult<HistoryEntry | null>;
  toggleFavorite(id: string): ServiceResult<HistoryEntry | null>;
  remove(id: string): ServiceResult<void>;
  clear(): ServiceResult<void>;
  count(): ServiceResult<number>;

  /** Fires after any change, so screens can refresh without polling. */
  subscribe(listener: () => void): Unsubscribe;
};

/** Default page size. Enough to fill a screen without reading the whole table. */
export const DEFAULT_HISTORY_LIMIT = 50;
/** Upper bound, so a caller cannot ask for the entire table by accident. */
const MAX_HISTORY_LIMIT = 500;

const COLUMNS = `id, source_text, translated_text, source_language, detected_language,
  target_language, engine, origin, is_favorite, created_at`;

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_HISTORY_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_HISTORY_LIMIT);
}

function clampOffset(offset: number | undefined): number {
  if (typeof offset !== 'number' || !Number.isFinite(offset) || offset <= 0) return 0;
  return Math.floor(offset);
}

/** Escapes the wildcards SQLite's LIKE treats specially, then wraps the term. */
function toLikePattern(query: string): string {
  const escaped = query.replace(/[\\%_]/g, (character) => `\\${character}`);
  return `%${escaped}%`;
}

export function createHistoryRepository(database: Database): HistoryRepository {
  let ready = false;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  /** Every read and write goes through this, so none can run before migrations. */
  function requireReady() {
    if (!ready) {
      return err(appError('storage_error', 'The local database is not ready.'));
    }
    return ok(undefined);
  }

  async function listBy(
    where: string,
    params: readonly unknown[],
    page: HistoryPage | undefined,
  ): ServiceResult<HistoryEntry[]> {
    const guard = requireReady();
    if (!guard.ok) return guard;

    // Ordering is the database's job: sorting in JavaScript would mean reading
    // every row first, which is exactly what the limit exists to avoid.
    const rows = await database.select<unknown>(
      `SELECT ${COLUMNS} FROM ${TABLES.translations}
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?;`,
      [...params, clampLimit(page?.limit), clampOffset(page?.offset)],
    );
    if (!rows.ok) return rows;

    return ok(toHistoryEntries(rows.value));
  }

  return {
    async initialize() {
      if (ready) return ok(undefined);

      const opened = await database.open();
      if (!opened.ok) return opened;

      const migrated = await database.migrate();
      if (!migrated.ok) return migrated;

      ready = true;
      return ok(undefined);
    },

    isReady() {
      return ready;
    },

    async create(result: TranslationResult) {
      const guard = requireReady();
      if (!guard.ok) return guard;

      // A fresh id per translation event. History records what the user did;
      // reusing the result id would collapse repeats and cache replays.
      const row = toTranslationRow(createId('h'), result);

      const written = await database.execute(
        `INSERT INTO ${TABLES.translations}
          (id, source_text, translated_text, source_language, detected_language,
           target_language, engine, origin, is_favorite, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          row.id,
          row.source_text,
          row.translated_text,
          row.source_language,
          row.detected_language,
          row.target_language,
          row.engine,
          row.origin,
          row.is_favorite,
          row.created_at,
        ],
      );
      if (!written.ok) return written;

      const entry = toHistoryEntry(row);
      if (!entry) {
        return err(appError('storage_error', 'The translation could not be saved.'));
      }

      notify();
      return ok(entry);
    },

    async getById(id: string) {
      const guard = requireReady();
      if (!guard.ok) return guard;

      const rows = await database.select<unknown>(
        `SELECT ${COLUMNS} FROM ${TABLES.translations} WHERE id = ? LIMIT 1;`,
        [id],
      );
      if (!rows.ok) return rows;

      // A missing row is a normal outcome, not a failure: the entry may have
      // been deleted while its detail screen was open.
      return ok(toHistoryEntry(rows.value[0]) ?? null);
    },

    listRecent(page) {
      return listBy('', [], page);
    },

    listFavorites(page) {
      return listBy('WHERE is_favorite = 1', [], page);
    },

    search(query: string, page) {
      const term = query.trim();
      if (term.length === 0) return this.listRecent(page);

      const pattern = toLikePattern(term);
      // Parameterised, always. User input is never concatenated into SQL.
      return listBy(
        `WHERE source_text LIKE ? ESCAPE '\\'
            OR translated_text LIKE ? ESCAPE '\\'
            OR source_language LIKE ? ESCAPE '\\'
            OR target_language LIKE ? ESCAPE '\\'`,
        [pattern, pattern, pattern, pattern],
        page,
      );
    },

    async setFavorite(id: string, isFavorite: boolean) {
      const guard = requireReady();
      if (!guard.ok) return guard;

      const written = await database.execute(
        `UPDATE ${TABLES.translations} SET is_favorite = ? WHERE id = ?;`,
        [isFavorite ? 1 : 0, id],
      );
      if (!written.ok) return written;

      notify();
      return this.getById(id);
    },

    async toggleFavorite(id: string) {
      const existing = await this.getById(id);
      if (!existing.ok) return existing;
      if (!existing.value) return ok(null);
      return this.setFavorite(id, !existing.value.isFavorite);
    },

    async remove(id: string) {
      const guard = requireReady();
      if (!guard.ok) return guard;

      // Favourite state lives on the row, so deleting the row removes it too.
      const deleted = await database.execute(`DELETE FROM ${TABLES.translations} WHERE id = ?;`, [
        id,
      ]);
      if (!deleted.ok) return deleted;

      notify();
      return ok(undefined);
    },

    async clear() {
      const guard = requireReady();
      if (!guard.ok) return guard;

      const cleared = await database.execute(`DELETE FROM ${TABLES.translations};`);
      if (!cleared.ok) return cleared;

      notify();
      return ok(undefined);
    },

    async count() {
      const guard = requireReady();
      if (!guard.ok) return guard;

      const rows = await database.select<{ total: number }>(
        `SELECT COUNT(*) AS total FROM ${TABLES.translations};`,
      );
      if (!rows.ok) return rows;

      return ok(Number(rows.value[0]?.total ?? 0));
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
