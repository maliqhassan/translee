import type { IncomingMessage, ServerResponse } from 'node:http';

import { apiError, fail, ok, statusFor, type ApiError, type Result } from './api-error';

/**
 * Reads a JSON body with a hard size cap.
 *
 * The cap is enforced while streaming, not after: a client that sends a
 * gigabyte should be cut off at the limit rather than buffered first. Mobile
 * input is never trusted.
 */
export async function readJsonBody(
  request: IncomingMessage,
  maxBytes: number,
): Promise<Result<unknown>> {
  // Cheapest rejection: refuse on the declared length before reading a byte.
  const declared = Number.parseInt(request.headers['content-length'] ?? '', 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    request.resume();
    return fail(apiError('text_too_long', 'Request body is too large.'));
  }

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const finish = (result: Result<unknown>) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        // Drain rather than destroy: killing the socket here would reset the
        // connection before the 413 could be written, and the client would
        // see a network error instead of the reason it was rejected.
        chunks.length = 0;
        request.resume();
        finish(fail(apiError('text_too_long', 'Request body is too large.')));
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim().length === 0) {
        finish(fail(apiError('invalid_request', 'Request body is empty.')));
        return;
      }
      try {
        finish(ok(JSON.parse(raw) as unknown));
      } catch {
        finish(fail(apiError('invalid_request', 'Request body is not valid JSON.')));
      }
    });

    request.on('error', () => {
      finish(fail(apiError('invalid_request', 'Request body could not be read.')));
    });
  });
}

export function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    // The API returns data, never markup; stop browsers from sniffing.
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

export function sendError(response: ServerResponse, error: ApiError): void {
  sendJson(response, statusFor(error.code), { error });
}
