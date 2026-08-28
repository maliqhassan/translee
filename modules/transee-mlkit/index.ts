import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * TypeScript face of the ML Kit native module.
 *
 * Resolved *optionally*. The module only exists in a build that compiled it —
 * not in Expo Go, and not in a JS-only bundle — so everything above must be
 * able to ask "is this here?" and carry on when the answer is no. That is what
 * keeps the app working, and `expo export` succeeding, without a native build.
 */

export type TranseeMlKitNativeModule = {
  /** Every BCP-47 code ML Kit can translate. */
  getSupportedLanguages(): string[];
  /** Codes whose model is downloaded, straight from ML Kit. */
  getDownloadedLanguages(): Promise<string[]>;
  downloadModel(language: string, requireWifi: boolean): Promise<void>;
  deleteModel(language: string): Promise<void>;
  /** Translates using already-downloaded models. */
  translate(source: string, target: string, text: string): Promise<string>;
  closeTranslator(source: string, target: string): Promise<void>;
  closeAll(): Promise<void>;
};

/** `null` whenever the native module was not compiled into this build. */
export const TranseeMlKit = requireOptionalNativeModule<TranseeMlKitNativeModule>('TranseeMlKit');

export function isMlKitModuleAvailable(): boolean {
  return TranseeMlKit !== null;
}
