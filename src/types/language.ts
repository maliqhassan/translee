/** BCP-47-ish short code, plus the sentinel `auto` for source detection. */
export type LanguageCode = string;

export type TextDirection = 'ltr' | 'rtl';

export type Language = {
  code: LanguageCode;
  /** English display name. */
  name: string;
  /** Endonym, shown as the secondary line in pickers. */
  nativeName: string;
  direction: TextDirection;
};

/** The source → target pair driving every translation surface. */
export type LanguagePair = {
  source: LanguageCode;
  target: LanguageCode;
};
