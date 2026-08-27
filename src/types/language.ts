/**
 * Stable identity of a catalogue entry, and the value stored in a language
 * pair, a translation request and a history row.
 *
 * Usually the ISO 639-1 code (`en`, `de`). Where a base code alone is
 * ambiguous it carries a BCP-47 script or region subtag (`zh-Hans`, `pt-BR`),
 * so the two Chinese scripts stay distinct entries rather than colliding.
 */
export type LanguageId = string;

/**
 * The bare ISO 639 code, without any script or region subtag. Engines that key
 * off a plain language code (`zh`, `pt`) use this rather than the id.
 */
export type LanguageCode = string;

export type TextDirection = 'ltr' | 'rtl';

/**
 * How a language is served on device. Deliberately structured rather than a
 * boolean: the download days need the model identity and its size, and this is
 * where those land once real models are chosen.
 */
export type OfflineLanguageSupport = {
  /** False until an on-device model has actually been selected for it. */
  supported: boolean;
  /** Identifier of the on-device model. Absent while `supported` is false. */
  modelId?: string;
  /** Rough download footprint in megabytes, for the packs screen. */
  approximateSizeMb?: number;
};

/** One entry in the language catalogue. The catalogue is the only source. */
export type Language = {
  id: LanguageId;
  code: LanguageCode;
  /** English display name, e.g. "Chinese (Simplified)". */
  name: string;
  /** Endonym, shown as the secondary line in pickers. */
  nativeName: string;
  direction: TextDirection;
  /** Script or region qualifier, when this entry is a variant of `code`. */
  variant?: string;
  /** Surfaced in the picker's shortlist. */
  isPopular: boolean;
  /** Whether a network engine is expected to handle it. */
  supportsOnline: boolean;
  offline: OfflineLanguageSupport;
};

/** The source → target pair driving every translation surface. */
export type LanguagePair = {
  source: LanguageId;
  target: LanguageId;
};
