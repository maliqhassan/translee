import type { LanguageId } from './language';

/**
 * How the user wants translations routed.
 *
 * This is a *preference*, not a claim about what exists. `offline` says which
 * engine the user wants tried; whether one is installed is the router's
 * question, and it answers honestly rather than quietly using the other one.
 */
export type TranslationMode = 'auto' | 'online' | 'offline';

export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * Everything the app remembers between launches.
 *
 * Deliberately small: every field here changes real behaviour today. Settings
 * for capabilities that do not exist yet (text to speech, language pack
 * downloads) are added on the day those capabilities land, so the screen never
 * offers a switch that does nothing.
 */
export type Preferences = {
  /**
   * The translation pair. The language store is the runtime source of truth;
   * these are the values it hydrates from and writes back to.
   *
   * `auto` as a source is how auto-detection is expressed — there is no
   * separate flag, because that would be the same fact stored twice.
   */
  sourceLanguage: LanguageId;
  targetLanguage: LanguageId;
  translationMode: TranslationMode;
  theme: ThemePreference;
  /** Save completed translations to the on-device history. */
  saveHistory: boolean;
};

/** Preference keys whose value is a boolean, so toggles stay type-safe. */
export type BooleanPreference = {
  [K in keyof Preferences]: Preferences[K] extends boolean ? K : never;
}[keyof Preferences];
