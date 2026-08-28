import type { ServiceResult } from '../types';

export type HttpMethod = 'GET' | 'POST';

export type HttpRequest = {
  url: string;
  method: HttpMethod;
  /** Serialised as JSON. */
  body?: unknown;
  headers?: Readonly<Record<string, string>>;
  /** Overrides the client default. */
  timeoutMs?: number;
  /** Lets a caller cancel independently of the timeout. */
  signal?: AbortSignal;
};

export type HttpResponse = {
  status: number;
  /** True for 2xx. */
  ok: boolean;
  /**
   * Parsed JSON body, or undefined when the body was empty or unparseable.
   * Deliberately `unknown`: nothing may read it without validating first.
   */
  data: unknown;
};

/**
 * Transport seam.
 *
 * A `Result` failure means the exchange never completed — no connection, or a
 * timeout. A *completed* exchange is always `ok`, whatever its status code, so
 * status handling stays a decision for the caller that understands the API
 * rather than something the transport guesses at.
 */
export type HttpClient = {
  send(request: HttpRequest): ServiceResult<HttpResponse>;
};
