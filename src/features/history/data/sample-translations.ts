import type { HistoryEntry } from '@/types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Sample rows so the recent-translations UI can be designed and reviewed before
 * storage exists. Replaced wholesale by the history repository on the
 * persistence day — nothing else imports this file.
 */
export const SAMPLE_TRANSLATIONS: readonly HistoryEntry[] = [
  {
    id: 'sample-1',
    sourceText: 'Where is the station?',
    translatedText: 'Wo ist der Bahnhof?',
    sourceLanguage: 'en',
    targetLanguage: 'de',
    engine: 'mock',
    origin: 'text',
    createdAt: Date.now() - 12 * MINUTE,
    isFavorite: false,
  },
  {
    id: 'sample-2',
    sourceText: 'I would like a coffee',
    translatedText: 'Vorrei un caffè',
    sourceLanguage: 'en',
    targetLanguage: 'it',
    engine: 'mock',
    origin: 'text',
    createdAt: Date.now() - 3 * HOUR,
    isFavorite: true,
  },
  {
    id: 'sample-3',
    sourceText: 'Thank you very much',
    translatedText: 'Muchas gracias',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    engine: 'mock',
    origin: 'voice',
    createdAt: Date.now() - 26 * HOUR,
    isFavorite: false,
  },
];
