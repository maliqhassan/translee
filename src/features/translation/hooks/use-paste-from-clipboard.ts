import { useCallback } from 'react';

import { services } from '@/services';

/** Reads the clipboard and hands the text back, or does nothing if it is empty. */
export function usePasteFromClipboard(onPaste: (text: string) => void): () => void {
  return useCallback(() => {
    void services.clipboard.paste().then((result) => {
      if (result.ok && result.value.trim()) onPaste(result.value);
    });
  }, [onPaste]);
}
