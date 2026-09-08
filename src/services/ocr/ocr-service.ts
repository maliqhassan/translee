import type { LanguageCode } from '@/types';

import type { Service, ServiceResult } from '../types';

/** Normalised 0–1 rectangle so overlays are resolution-independent. */
export type BoundingBox = { x: number; y: number; width: number; height: number };

export type RecognizedTextBlock = {
  id: string;
  text: string;
  box: BoundingBox;
  /**
   * 0–1 recognition confidence, when the recogniser reports one.
   *
   * Optional because ML Kit's text recogniser does not expose a confidence for
   * blocks, lines or elements. The same rule as model sizes applies: a field a
   * runtime cannot fill is left undefined rather than filled with a guess.
   */
  confidence?: number;
};

export type OCRResult = {
  /** All blocks joined in reading order. */
  fullText: string;
  blocks: RecognizedTextBlock[];
  detectedLanguage?: LanguageCode;
};

export type OCRRequest = {
  /** Local file URI of the captured frame. */
  imageUri: string;
  /** Hint for the recogniser; omit to let it decide. */
  languageHint?: LanguageCode;
};

/** Text recognition from a still image or a live camera frame. */
export type OCRService = Service & {
  recognize(request: OCRRequest): ServiceResult<OCRResult>;
  /** Whether live (per-frame) recognition is supported on this device. */
  supportsLiveRecognition(): Promise<boolean>;
};
