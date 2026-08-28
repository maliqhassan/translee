/**
 * The API's error vocabulary.
 *
 * These codes are the contract: the mobile app maps them onto its own
 * `AppErrorCode` and never sees a provider's error shape, HTTP status or
 * message. Adding a code here is a contract change.
 */
export type ApiErrorCode =
  | 'invalid_request'
  | 'unsupported_language'
  | 'text_too_long'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'provider_error'
  | 'not_found'
  | 'internal_error';

export type ApiError = {
  code: ApiErrorCode;
  /** Safe to show a user. Never contains provider or credential detail. */
  message: string;
};

const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  unsupported_language: 422,
  text_too_long: 413,
  rate_limited: 429,
  provider_unavailable: 503,
  provider_error: 502,
  not_found: 404,
  internal_error: 500,
};

export function statusFor(code: ApiErrorCode): number {
  return STATUS[code];
}

export function apiError(code: ApiErrorCode, message: string): ApiError {
  return { code, message };
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(error: ApiError): Result<T> => ({ ok: false, error });
