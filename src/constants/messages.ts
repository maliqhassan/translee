import type { AppError, AppErrorCode } from '@/types';

/**
 * User-facing copy for failures. Nothing technical reaches the screen: the
 * `AppError.message` is for logs, this map is for people.
 */
const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  network_unavailable: 'You appear to be offline. Check your connection and try again.',
  not_implemented: 'That is not available in this build yet.',
  service_unavailable: 'Translation is unavailable right now. Please try again in a moment.',
  permission_denied: 'Transee needs permission to do that. You can grant it in Settings.',
  unsupported_language: 'This language pair is not available yet. Try a different pair.',
  model_missing: 'That language pack is not downloaded yet.',
  storage_error: 'Something went wrong saving to this device.',
  cancelled: 'That was cancelled.',
  unknown: 'Something went wrong. Please try again.',
};

export function errorMessage(error: AppError): string {
  return ERROR_MESSAGES[error.code];
}
