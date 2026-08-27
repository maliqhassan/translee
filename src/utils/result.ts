import type { AppError, AppErrorCode } from '@/types';

/**
 * Services return `Result` instead of throwing, so callers are forced by the
 * type system to handle failure. Keeps error handling out of screen bodies.
 */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function appError(code: AppErrorCode, message: string, cause?: unknown): AppError {
  return { code, message, cause };
}

/** Standard failure for the Day 1 service placeholders. */
export function notImplemented(what: string): AppError {
  return appError('not_implemented', `${what} is not implemented yet.`);
}
