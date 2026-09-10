import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { getDeviceStorage } from '@/lib/storage/device-storage';
import de from './locales/de.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['de', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'de';
export const LANGUAGE_STORAGE_KEY = 'fam:language';

const resources = {
  de: { translation: de },
  en: { translation: en },
};

function isAppLanguage(value: string): value is AppLanguage {
  return value === 'de' || value === 'en';
}

/** Reduziert einen BCP-47-Locale-Tag auf eine unterstützte App-Sprache. */
export function resolveLanguage(value: string | null | undefined): AppLanguage | null {
  if (!value) return null;

  const languageCode = value.toLowerCase().split(/[-_]/, 1)[0];
  return isAppLanguage(languageCode) ? languageCode : null;
}

/** Liest die optionale manuelle Sprache aus dem unverschlüsselten Gerätespeicher. */
export function getStoredLanguage(): AppLanguage | null {
  try {
    return resolveLanguage(getDeviceStorage().getString(LANGUAGE_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Ermittelt die Sprache mit manueller Auswahl, Gerätesprache und Fallback. */
export function getInitialLanguage(): AppLanguage {
  const storedLanguage = getStoredLanguage();
  if (storedLanguage) return storedLanguage;

  const [preferredLocale] = getLocales();
  return (
    resolveLanguage(preferredLocale?.languageCode ?? preferredLocale?.languageTag) ??
    DEFAULT_LANGUAGE
  );
}

export const i18n = i18next;

void i18n.use(initReactI18next).init({
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  lng: getInitialLanguage(),
  resources,
  supportedLngs: SUPPORTED_LANGUAGES,
  react: { useSuspense: false },
});

/** Speichert die manuelle Auswahl und aktualisiert alle react-i18next-Consumer. */
export async function setAppLanguage(language: AppLanguage): Promise<void> {
  getDeviceStorage().set(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(language);
}
