import * as Clipboard from 'expo-clipboard';

import { appError, createLogger, err, ok } from '@/utils';

import type { ServiceResult } from '../types';

import type { ClipboardService } from './clipboard-service';

const log = createLogger('clipboard');

/** Expo-backed clipboard. The only file in the app that imports expo-clipboard. */
export const expoClipboardService: ClipboardService = {
  id: 'clipboard',

  async isAvailable() {
    return true;
  },

  async copy(text: string): ServiceResult<void> {
    try {
      await Clipboard.setStringAsync(text);
      return ok(undefined);
    } catch (cause) {
      log.error('copy failed', cause);
      return err(appError('unknown', 'Could not write to the clipboard.', cause));
    }
  },

  async paste(): ServiceResult<string> {
    try {
      return ok(await Clipboard.getStringAsync());
    } catch (cause) {
      log.error('paste failed', cause);
      return err(appError('unknown', 'Could not read the clipboard.', cause));
    }
  },

  async hasText() {
    try {
      return await Clipboard.hasStringAsync();
    } catch {
      return false;
    }
  },
};
