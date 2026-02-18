import { en, I18nKey } from './en';
import { it } from './it';

type Translations = Record<I18nKey, string>;
type PartialTranslations = Partial<Translations>;

const locales: Record<string, PartialTranslations> = { en, it };

let currentLocale = 'en';

/**
 * Sets the locale to the specified language code.
 * Falls back to 'en' if the locale is not supported.
 * @param lang - Language code ('en', 'it')
 */
export function initLocale(lang?: string): void {
  const normalized = (lang || 'en').split('-')[0].toLowerCase();
  currentLocale = locales[normalized] ? normalized : 'en';
}

/**
 * Returns the current locale code.
 */
export function getLocale(): string {
  return currentLocale;
}

/**
 * Translates a key, interpolating `{var}` placeholders with the provided vars.
 * Falls back to English if the key is missing in the current locale.
 */
export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  const locale = locales[currentLocale] as PartialTranslations;
  const fallback = locales['en'] as Translations;

  let message: string = locale[key] ?? fallback[key] ?? String(key);

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      message = message.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return message;
}

export { I18nKey };
