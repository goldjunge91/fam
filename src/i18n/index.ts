import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { getDeviceStorage } from '@/lib/storage/device-storage';
import authDe from './features/auth.de.json';
import authEn from './features/auth.en.json';
import commonDe from './features/common.de.json';
import commonEn from './features/common.en.json';
import dashboardDe from './features/dashboard.de.json';
import dashboardEn from './features/dashboard.en.json';
import ocrDe from './features/ocr.de.json';
import ocrEn from './features/ocr.en.json';
import settingsDe from './features/settings.de.json';
import settingsEn from './features/settings.en.json';
import shoppingListDe from './features/shopping-list.de.json';
import shoppingListEn from './features/shopping-list.en.json';

export const SUPPORTED_LANGUAGES = ['de', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'de';
export const LANGUAGE_OVERRIDE_STORAGE_KEY = 'dev.language_override.v1';

const resources = {
  de: {
    translation: {
      auth: authDe,
      common: commonDe,
      dashboard: dashboardDe,
      ocr: ocrDe,
      settings: settingsDe,
      shoppingList: shoppingListDe,
    },
  },
  en: {
    translation: {
      auth: authEn,
      common: commonEn,
      dashboard: dashboardEn,
      ocr: ocrEn,
      settings: settingsEn,
      shoppingList: shoppingListEn,
    },
  },
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

/** Liest die optionale Sprache für lokale Entwickler-Overrides. */
export function getLanguageOverride(): AppLanguage | null {
  try {
    return resolveLanguage(getDeviceStorage().getString(LANGUAGE_OVERRIDE_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Ermittelt die unterstützte Sprache der ersten Gerätesprache oder den Fallback. */
export function getDeviceLanguage(): AppLanguage {
  const [preferredLocale] = getLocales();
  return (
    resolveLanguage(preferredLocale?.languageCode ?? preferredLocale?.languageTag) ??
    DEFAULT_LANGUAGE
  );
}

/** Der App-Start verwendet nur einen expliziten Dev-Override oder die Gerätesprache. */
export function getInitialLanguage(): AppLanguage {
  return getLanguageOverride() ?? getDeviceLanguage();
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

/** Setzt oder entfernt den Dev-Override und aktualisiert alle react-i18next-Consumer. */
export async function setLanguageOverride(language: AppLanguage | null): Promise<void> {
  const storage = getDeviceStorage();
  if (language) storage.set(LANGUAGE_OVERRIDE_STORAGE_KEY, language);
  else storage.remove(LANGUAGE_OVERRIDE_STORAGE_KEY);

  await i18n.changeLanguage(language ?? getDeviceLanguage());
}
