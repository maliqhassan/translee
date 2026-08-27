import { err, notImplemented } from '@/utils';

import type { ServiceResult } from '../types';

import type { OCRResult, OCRService } from './ocr-service';

export * from './ocr-service';

/** Placeholder. Camera permissions and the recognizer land on the camera day. */
export const ocrService: OCRService = {
  id: 'ocr',

  async isAvailable() {
    return false;
  },

  async supportsLiveRecognition() {
    return false;
  },

  recognize(): ServiceResult<OCRResult> {
    return Promise.resolve(err(notImplemented('Text recognition')));
  },
};
