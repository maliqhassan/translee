import { appError, createId, createLogger, err, ok } from '@/utils';

import type { ServiceResult } from '../types';

import type { OCRRequest, OCRResult, OCRService, RecognizedTextBlock } from './ocr-service';

const log = createLogger('ocr');

/**
 * Text recognition, behind the Day 1 `OCRService` contract.
 *
 * Nothing above this file knows ML Kit is underneath. The native module is
 * injected rather than imported directly, so the whole service is testable
 * against a fake without a device — the same shape as the translation engine.
 *
 * **This one really is offline.** The Latin recognition model is bundled into
 * the APK, so scanning needs no download, no language pack and no network.
 * That is a stronger claim than either translation (which needs a downloaded
 * model) or speech recognition (which usually needs a network), and it is
 * true because the model ships inside the binary.
 *
 * Neither the image nor the recognised text is ever logged.
 */

/** The subset of the native module this service uses. */
export type OcrNative = {
  recognize(uri: string): Promise<{
    text: string;
    blocks: { text: string; x: number; y: number; width: number; height: number }[];
  }>;
};

export type MlKitOcrOptions = {
  /** Null when the native module was not compiled into this build. */
  native: OcrNative | null;
};

/**
 * Turns a native rejection into an app error without letting it through.
 *
 * A recogniser message can quote the text it read, so only the code is
 * inspected and the message is dropped.
 */
function toAppError(cause: unknown) {
  const code =
    typeof cause === 'object' && cause !== null && 'code' in cause
      ? String((cause as { code?: unknown }).code)
      : '';

  if (code.includes('ocr_image_unreadable')) {
    return appError('invalid_request', 'That image could not be read.');
  }
  if (code.includes('ocr_unavailable')) {
    return appError('service_unavailable', 'Text recognition is not available right now.');
  }
  return appError('unknown', 'Text could not be recognised in that image.');
}

export function createMlKitOcrService(options: MlKitOcrOptions): OCRService {
  const { native } = options;

  return {
    id: 'ocr.mlkit',

    async isAvailable() {
      return native !== null;
    },

    async supportsLiveRecognition() {
      // Per-frame recognition would need a frame processor this build does not
      // have. Recognition runs on a still capture, and saying so beats
      // claiming a capability and then failing to deliver it.
      return false;
    },

    async recognize(request: OCRRequest): ServiceResult<OCRResult> {
      if (!native) {
        return err(
          appError('service_unavailable', 'Text recognition is not available in this build.'),
        );
      }

      if (!request.imageUri) {
        return err(appError('invalid_request', 'There is no image to read.'));
      }

      try {
        const result = await native.recognize(request.imageUri);

        // An image with no text is a real outcome, not a failure: the caller
        // is told plainly rather than being handed an empty success that
        // silently blanks whatever the user had typed.
        if (!result.text.trim()) {
          return err(appError('invalid_request', 'No text was found in that image.'));
        }

        const blocks = result.blocks.map<RecognizedTextBlock>((block) => ({
          id: createId('blk'),
          text: block.text,
          box: { x: block.x, y: block.y, width: block.width, height: block.height },
          // confidence is deliberately absent: ML Kit does not report one.
        }));

        return ok({
          fullText: result.text,
          blocks,
          // `detectedLanguage` is left undefined. ML Kit reports a per-block
          // language tag that is frequently empty and does not map onto our
          // catalogue, and guessing the source language from it would be worse
          // than letting the user keep the one they chose.
        });
      } catch (cause) {
        // Never the native message, and never the image or the text.
        log.warn('text recognition failed');
        return err(toAppError(cause));
      }
    },
  };
}
