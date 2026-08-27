import type { LanguageCode } from '@/types';

/**
 * Languages the sample engine knows. Deliberately small — this is a stand-in
 * for a real engine, not a translation database.
 */
export const MOCK_LANGUAGES: readonly LanguageCode[] = ['en', 'de', 'es', 'fr', 'it', 'ja'];

/**
 * A handful of everyday phrases so the UI demonstrates a believable round trip.
 * Keys are normalised English; values are keyed by target language.
 */
export const DEMO_PHRASES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  hello: { de: 'Hallo', es: 'Hola', fr: 'Bonjour', it: 'Ciao', ja: 'こんにちは' },
  'good morning': {
    de: 'Guten Morgen',
    es: 'Buenos días',
    fr: 'Bonjour',
    it: 'Buongiorno',
    ja: 'おはようございます',
  },
  'good evening': {
    de: 'Guten Abend',
    es: 'Buenas tardes',
    fr: 'Bonsoir',
    it: 'Buonasera',
    ja: 'こんばんは',
  },
  'thank you': {
    de: 'Danke',
    es: 'Gracias',
    fr: 'Merci',
    it: 'Grazie',
    ja: 'ありがとう',
  },
  please: {
    de: 'Bitte',
    es: 'Por favor',
    fr: "S'il vous plaît",
    it: 'Per favore',
    ja: 'お願いします',
  },
  'excuse me': {
    de: 'Entschuldigung',
    es: 'Disculpe',
    fr: 'Excusez-moi',
    it: 'Mi scusi',
    ja: 'すみません',
  },
  'how are you': {
    de: 'Wie geht es dir',
    es: '¿Cómo estás?',
    fr: 'Comment allez-vous',
    it: 'Come stai',
    ja: 'お元気ですか',
  },
  'where is the station': {
    de: 'Wo ist der Bahnhof',
    es: '¿Dónde está la estación?',
    fr: 'Où est la gare',
    it: "Dov'è la stazione",
    ja: '駅はどこですか',
  },
  'how much does this cost': {
    de: 'Wie viel kostet das',
    es: '¿Cuánto cuesta esto?',
    fr: 'Combien ça coûte',
    it: 'Quanto costa questo',
    ja: 'これはいくらですか',
  },
  'i would like a coffee': {
    de: 'Ich hätte gerne einen Kaffee',
    es: 'Quisiera un café',
    fr: 'Je voudrais un café',
    it: 'Vorrei un caffè',
    ja: 'コーヒーをお願いします',
  },
  'i do not understand': {
    de: 'Ich verstehe nicht',
    es: 'No entiendo',
    fr: 'Je ne comprends pas',
    it: 'Non capisco',
    ja: 'わかりません',
  },
  'can you help me': {
    de: 'Kannst du mir helfen',
    es: '¿Puedes ayudarme?',
    fr: 'Pouvez-vous m’aider',
    it: 'Puoi aiutarmi',
    ja: '手伝ってもらえますか',
  },
  'good night': {
    de: 'Gute Nacht',
    es: 'Buenas noches',
    fr: 'Bonne nuit',
    it: 'Buonanotte',
    ja: 'おやすみなさい',
  },
  goodbye: {
    de: 'Auf Wiedersehen',
    es: 'Adiós',
    fr: 'Au revoir',
    it: 'Arrivederci',
    ja: 'さようなら',
  },
};

/** Lowercases, trims and drops surrounding punctuation so lookups are forgiving. */
export function normalizePhrase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[!?.,¿¡]+$/u, '')
    .replace(/^[¿¡]+/u, '')
    .replace(/\s+/gu, ' ');
}

/** Reverse index: a translated phrase in language X back to its English key. */
const REVERSE_INDEX: ReadonlyMap<string, string> = new Map(
  Object.entries(DEMO_PHRASES).flatMap(([english, translations]) =>
    Object.entries(translations).map(([language, phrase]): [string, string] => [
      `${language}:${normalizePhrase(phrase)}`,
      english,
    ]),
  ),
);

/** Finds the English key for a phrase written in `language`, if it is known. */
export function toEnglishKey(language: LanguageCode, text: string): string | undefined {
  if (language === 'en') {
    const normalized = normalizePhrase(text);
    return normalized in DEMO_PHRASES ? normalized : undefined;
  }
  return REVERSE_INDEX.get(`${language}:${normalizePhrase(text)}`);
}

/** Dictionary keys are lowercase; English output should still read naturally. */
function toSentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Looks up the phrase for `target`, given its English key. */
export function fromEnglishKey(englishKey: string, target: LanguageCode): string | undefined {
  if (target === 'en') return toSentenceCase(englishKey);
  return DEMO_PHRASES[englishKey]?.[target];
}
