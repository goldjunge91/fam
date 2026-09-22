let mockDeviceLanguage = 'en';
const mockValues = new Map<string, string>();

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: mockDeviceLanguage, languageTag: `${mockDeviceLanguage}-XX` }],
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockValues.get(key),
    remove: (key: string) => mockValues.delete(key),
    set: (key: string, value: string) => mockValues.set(key, value),
  }),
}));

import {
  getDeviceLanguage,
  getInitialLanguage,
  getLanguageOverride,
  i18n,
  LANGUAGE_OVERRIDE_STORAGE_KEY,
  resolveLanguage,
  setLanguageOverride,
} from './index';

describe('app language', () => {
  beforeEach(() => {
    mockValues.clear();
    mockDeviceLanguage = 'en';
  });

  it('uses the supported language from a locale tag', () => {
    expect(resolveLanguage('en-US')).toBe('en');
    expect(resolveLanguage('de-DE')).toBe('de');
  });

  it('falls back to German for an unsupported locale', () => {
    expect(resolveLanguage('fr-FR')).toBeNull();
    expect(getInitialLanguage()).toBe('en');

    mockDeviceLanguage = 'fr';

    expect(getInitialLanguage()).toBe('de');
  });

  it('loads bundled translations for both supported languages', async () => {
    await i18n.changeLanguage('de');
    expect(i18n.t('shoppingList.addItem')).toBe('Artikel hinzufügen');
    expect(i18n.t('settings.groups.data.privacy.label')).toBe('Datenschutz');
    expect(i18n.t('shoppingList.screen.completeActionGeneric')).toBe('Einkaufsliste abschließen');
    expect(i18n.t('ocr.review.title')).toBe('Kassenbon prüfen');

    await i18n.changeLanguage('en');
    expect(i18n.t('shoppingList.addItem')).toBe('Add item');
    expect(i18n.t('settings.groups.data.privacy.label')).toBe('Privacy');
    expect(i18n.t('shoppingList.screen.completeActionGeneric')).toBe('Complete shopping list');
    expect(i18n.t('ocr.review.title')).toBe('Review receipt');
  });

  it('uses the device language when no dev override exists', () => {
    mockValues.set('fam:language', 'de');

    expect(getLanguageOverride()).toBeNull();
    expect(getDeviceLanguage()).toBe('en');
    expect(getInitialLanguage()).toBe('en');
  });

  it('prefers and persists an explicit dev language override', async () => {
    mockValues.set(LANGUAGE_OVERRIDE_STORAGE_KEY, 'de');

    expect(getLanguageOverride()).toBe('de');
    expect(getInitialLanguage()).toBe('de');

    await setLanguageOverride('en');

    expect(mockValues.get(LANGUAGE_OVERRIDE_STORAGE_KEY)).toBe('en');
    expect(i18n.language).toBe('en');
  });

  it('removes the override and returns to the device language', async () => {
    mockValues.set(LANGUAGE_OVERRIDE_STORAGE_KEY, 'de');

    await setLanguageOverride(null);

    expect(mockValues.get(LANGUAGE_OVERRIDE_STORAGE_KEY)).toBeUndefined();
    expect(getInitialLanguage()).toBe('en');
    expect(i18n.language).toBe('en');
  });
});
