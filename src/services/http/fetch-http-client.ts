import { createLogger, err, ok } from '@/utils';

import type { ServiceResult } from '../types';

import type { HttpClient, HttpRequest, HttpResponse } from './http-client';
import { isAbortError, networkError, timeoutError } from './http-errors';

const log = createLogger('http');

export type FetchHttpClientOptions = {
  defaultTimeoutMs: number;
  /** Injectable so tests can drive the transport without a network. */
  fetchImpl?: typeof fetch;
};

/**
 * `fetch` behind the `HttpClient` seam, with a timeout it cannot outlive.
 *
 * `fetch` has no timeout of its own, so every request gets an AbortController
 * that fires on a timer. An abort we started is reported as a timeout; an abort
 * from the caller's own signal is reported as a plain network failure, since
 * only the caller knows why it cancelled.
 */
export function createFetchHttpClient(options: FetchHttpClientOptions): HttpClient {
  const doFetch = options.fetchImpl ?? fetch;

  return {
    async send(request: HttpRequest): ServiceResult<HttpResponse> {
      const timeoutMs = request.timeoutMs ?? options.defaultTimeoutMs;
      const controller = new AbortController();

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      const onCallerAbort = () => controller.abort();
      request.signal?.addEventListener('abort', onCallerAbort);

      try {
        const response = await doFetch(request.url, {
          method: request.method,
          headers: {
            Accept: 'application/json',
            ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...request.headers,
          },
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
          signal: controller.signal,
        });

        // A body that is absent or not JSON is not fatal here — the caller
        // validates `data`, and the status alone may be all it needs.
        let data: unknown;
        try {
          const text = await response.text();
          data = text.length > 0 ? (JSON.parse(text) as unknown) : undefined;
        } catch (cause) {
          log.warn('response body was not JSON', cause);
          data = undefined;
        }

        return ok({ status: response.status, ok: response.ok, data });
      } catch (cause) {
        if (timedOut) return err(timeoutError(timeoutMs, cause));
        if (isAbortError(cause)) return err(networkError(cause));
        log.warn('request failed', cause);
        return err(networkError(cause));
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', onCallerAbort);
      }
    },
  };
}
