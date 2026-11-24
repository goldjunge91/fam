import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { getDeviceStorage } from '@/lib/storage/local-device-storage';
import aiAssistantDe from './features/ai-assistant.de.json';
import aiAssistantEn from './features/ai-assistant.en.json';
import authDe from './features/auth.de.json';
import authEn from './features/auth.en.json';
import brochuresDe from './features/brochures.de.json';
import brochuresEn from './features/brochures.en.json';
import calorieTrackingDe from './features/calorie-tracking.de.json';
import calorieTrackingEn from './features/calorie-tracking.en.json';
import commonDe from './features/common.de.json';
import commonEn from './features/common.en.json';
import dashboardDe from './features/dashboard.de.json';
import dashboardEn from './features/dashboard.en.json';
import devDe from './features/dev.de.json';
import devEn from './features/dev.en.json';
import feedbackDe from './features/feedback.de.json';
import feedbackEn from './features/feedback.en.json';
import gamificationDe from './features/gamification.de.json';
import gamificationEn from './features/gamification.en.json';
import glp1De from './features/glp1.de.json';
import glp1En from './features/glp1.en.json';
import householdDe from './features/household.de.json';
import householdEn from './features/household.en.json';
import inventoryDe from './features/inventory.de.json';
import inventoryEn from './features/inventory.en.json';
import mealPlannerDe from './features/meal-planner.de.json';
import mealPlannerEn from './features/meal-planner.en.json';
import navigationDe from './features/navigation.de.json';
import navigationEn from './features/navigation.en.json';
import ocrDe from './features/ocr.de.json';
import ocrEn from './features/ocr.en.json';
import onboardingDe from './features/onboarding.de.json';
import onboardingEn from './features/onboarding.en.json';
import premiumDe from './features/premium.de.json';
import premiumEn from './features/premium.en.json';
import productSearchDe from './features/product-search.de.json';
import productSearchEn from './features/product-search.en.json';
import profileDe from './features/profile.de.json';
import profileEn from './features/profile.en.json';
import recipeImportDe from './features/recipe-import.de.json';
import recipeImportEn from './features/recipe-import.en.json';
import recipesDe from './features/recipes.de.json';
import recipesEn from './features/recipes.en.json';
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
      aiAssistant: aiAssistantDe,
      auth: authDe,
      brochures: brochuresDe,
      calorieTracking: calorieTrackingDe,
      common: commonDe,
      dashboard: dashboardDe,
      dev: devDe,
      feedback: feedbackDe,
      gamification: gamificationDe,
      glp1: glp1De,
      household: householdDe,
      inventory: inventoryDe,
      navigation: navigationDe,
      mealPlanner: mealPlannerDe,
      onboarding: onboardingDe,
      ocr: ocrDe,
      premium: premiumDe,
      productSearch: productSearchDe,
      profile: profileDe,
      recipeImport: recipeImportDe,
      recipes: recipesDe,
      settings: settingsDe,
      shoppingList: shoppingListDe,
    },
  },
  en: {
    translation: {
      aiAssistant: aiAssistantEn,
      auth: authEn,
      brochures: brochuresEn,
      calorieTracking: calorieTrackingEn,
      common: commonEn,
      dashboard: dashboardEn,
      dev: devEn,
      feedback: feedbackEn,
      gamification: gamificationEn,
      glp1: glp1En,
      household: householdEn,
      inventory: inventoryEn,
      navigation: navigationEn,
      mealPlanner: mealPlannerEn,
      onboarding: onboardingEn,
      ocr: ocrEn,
      premium: premiumEn,
      productSearch: productSearchEn,
      profile: profileEn,
      recipeImport: recipeImportEn,
      recipes: recipesEn,
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
