import type { Language, TextDirection } from '@/types';

/**
 * The authoritative language catalogue. Nothing else in the app may define
 * language metadata — components read it through the selectors in
 * `constants/languages.ts`.
 *
 * Codes are ISO 639-1 where one exists, ISO 639-2/3 otherwise (`fil`). Entries
 * whose base code is ambiguous carry a BCP-47 subtag in `id` and keep the bare
 * code in `code`, so `zh-Hans` and `zh-Hant` are separate rows that both report
 * `zh` to an engine.
 *
 * Every entry currently reports `offline.supported: false`. Real model ids and
 * sizes are filled in on the offline-model days; the shape is already correct,
 * so that is a data edit rather than a refactor.
 */

type Entry = {
  /** Defaults to `code`; set only for script or region variants. */
  id?: string;
  code: string;
  name: string;
  nativeName: string;
  dir?: TextDirection;
  /** Script or region qualifier; implies `id` differs from `code`. */
  variant?: string;
  popular?: true;
};

function toLanguage(entry: Entry): Language {
  return {
    id: entry.id ?? entry.code,
    code: entry.code,
    name: entry.name,
    nativeName: entry.nativeName,
    direction: entry.dir ?? 'ltr',
    variant: entry.variant,
    isPopular: entry.popular ?? false,
    supportsOnline: true,
    // No on-device model has been chosen for any language yet.
    offline: { supported: false },
  };
}

const ENTRIES: readonly Entry[] = [
  { code: 'en', name: 'English', nativeName: 'English', popular: true },
  { code: 'es', name: 'Spanish', nativeName: 'Español', popular: true },
  { code: 'fr', name: 'French', nativeName: 'Français', popular: true },
  { code: 'de', name: 'German', nativeName: 'Deutsch', popular: true },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', popular: true },
  {
    id: 'pt-BR',
    code: 'pt',
    variant: 'BR',
    name: 'Portuguese (Brazil)',
    nativeName: 'Português (Brasil)',
    popular: true,
  },
  {
    id: 'pt-PT',
    code: 'pt',
    variant: 'PT',
    name: 'Portuguese (Portugal)',
    nativeName: 'Português (Portugal)',
  },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', popular: true },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', popular: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', popular: true },
  {
    id: 'zh-Hans',
    code: 'zh',
    variant: 'Hans',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    popular: true,
  },
  {
    id: 'zh-Hant',
    code: 'zh',
    variant: 'Hant',
    name: 'Chinese (Traditional)',
    nativeName: '繁體中文',
  },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', popular: true },

  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', dir: 'rtl' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'fil', name: 'Filipino', nativeName: 'Filipino' },
  { code: 'jv', name: 'Javanese', nativeName: 'Basa Jawa' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာ' },
  { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ' },
  { code: 'lo', name: 'Lao', nativeName: 'ລາວ' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', dir: 'rtl' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски' },
  { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina' },
  { code: 'mk', name: 'Macedonian', nativeName: 'Македонски' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip' },
  { code: 'be', name: 'Belarusian', nativeName: 'Беларуская' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'nb', name: 'Norwegian Bokmål', nativeName: 'Norsk bokmål' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge' },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg' },
  { code: 'mt', name: 'Maltese', nativeName: 'Malti' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara' },
  { code: 'gl', name: 'Galician', nativeName: 'Galego' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақ тілі' },
  { code: 'ky', name: 'Kyrgyz', nativeName: 'Кыргызча' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbekcha' },
  { code: 'tg', name: 'Tajik', nativeName: 'Тоҷикӣ' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو', dir: 'rtl' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', dir: 'rtl' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali' },
  { code: 'mg', name: 'Malagasy', nativeName: 'Malagasy' },
];

/** Sentinel used as a *source* only. Not a language, and never a target. */
export const AUTO_DETECT_ID = 'auto';

export const AUTO_DETECT: Language = {
  id: AUTO_DETECT_ID,
  code: AUTO_DETECT_ID,
  name: 'Detect language',
  nativeName: 'Detect language',
  direction: 'ltr',
  isPopular: false,
  supportsOnline: true,
  offline: { supported: false },
};

/** Every real language, alphabetical by English name. */
export const LANGUAGE_CATALOG: readonly Language[] = ENTRIES.map(toLanguage).sort((a, b) =>
  a.name.localeCompare(b.name),
);
