import type { HistoryRepository } from '@/database';
import type { ServiceResult, TranslationRouter } from '@/services';
import type { TranslationRequest, TranslationResult } from '@/types';

/** Only the part of the repository this needs, so tests can pass a real one. */
export type HistoryWriter = Pick<HistoryRepository, 'create'>;

/**
 * Translates, then records the attempt in history.
 *
 * Kept out of the hook so the policy is testable without React, and stated in
 * one place:
 *
 * - a **failed** translation writes nothing; history is a record of results,
 *   not of attempts
 * - history is skipped entirely when the user has turned `saveHistory` off
 * - a **cached** translation still writes a new record, because the cache
 *   answers "what can we reuse" and history answers "what did the user do"
 * - a history write failure never fails the translation. The user can already
 *   see the result; losing the record is the lesser problem, and the history
 *   screen reports its own unavailability separately.
 */
export type RecordOptions = {
  /** The user's `saveHistory` preference. Off means nothing is written. */
  saveHistory?: boolean;
};

export async function translateAndRecord(
  router: TranslationRouter,
  history: HistoryWriter,
  request: TranslationRequest,
  options: RecordOptions = {},
): ServiceResult<TranslationResult> {
  const result = await router.translate(request);

  if (result.ok && options.saveHistory !== false) {
    // Deliberately not awaited: the caller should not wait on a local write to
    // show a translation that is already in hand.
    void history.create(result.value);
  }

  return result;
}
