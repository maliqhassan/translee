import type { ServiceResult } from '@/services';

/**
 * Minimal database seam. Repositories depend on this rather than on a driver,
 * so the SQLite implementation can be introduced (and mocked) independently.
 */
export type Database = {
  open(): ServiceResult<void>;
  close(): Promise<void>;
  /** Applies any pending migrations. Safe to call on every start-up. */
  migrate(): ServiceResult<void>;
  select<T>(sql: string, params?: readonly unknown[]): ServiceResult<T[]>;
  execute(sql: string, params?: readonly unknown[]): ServiceResult<void>;
  transaction(work: (tx: Database) => Promise<void>): ServiceResult<void>;
};

/**
 * Repositories keep SQL out of features. Each one is implemented alongside the
 * feature that needs it.
 */
export type Repository<TEntity, TId = string> = {
  findById(id: TId): ServiceResult<TEntity | null>;
  findAll(limit?: number, offset?: number): ServiceResult<TEntity[]>;
  save(entity: TEntity): ServiceResult<void>;
  remove(id: TId): ServiceResult<void>;
  clear(): ServiceResult<void>;
};
