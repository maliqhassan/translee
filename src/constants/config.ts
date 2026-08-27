/** App-wide constants. Anything tweakable without a code review lives here. */
export const APP = {
  name: 'Transee',
  tagline: 'Translate anywhere, online or off',
} as const;

/** Keys for persisted values. Namespaced so a stray key can never collide. */
export const STORAGE_KEYS = {
  preferences: 'transee.preferences.v1',
  languageSelection: 'transee.languages.v1',
} as const;

export const DEFAULTS = {
  sourceLanguage: 'en',
  targetLanguage: 'de',
  /** Debounce before an as-you-type translation would be requested. */
  translateDebounceMs: 450,
  maxInputLength: 5000,
  /** Point at which the character counter starts warning, as a ratio. */
  inputWarningRatio: 0.9,
  historyPageSize: 30,
  /** Recent translations surfaced on the home screen. */
  recentOnHome: 3,
} as const;

/**
 * Feature flags. Days 2–20 flip these on as each capability lands, which keeps
 * half-built features off the UI without branching the codebase.
 */
export const FEATURES = {
  /**
   * Routes every translation to the in-memory sample engine. Turn off in the
   * same change that registers a real engine in the service registry.
   */
  mockTranslation: true,
  offlineTranslation: false,
  cameraOcr: false,
  speechInput: false,
  textToSpeech: false,
  conversationMode: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;
