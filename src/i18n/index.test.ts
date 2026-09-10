let mockDeviceLanguage = 'en';
const mockValues = new Map<string, string>();

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: mockDeviceLanguage, languageTag: `${mockDeviceLanguage}-XX` }],
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockValues.get(key),
    set: (key: string, value: string) => mockValues.set(key, value),
  }),
}));

import {
  getInitialLanguage,
  getStoredLanguage,
  i18n,
  resolveLanguage,
  setAppLanguage,
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

    await i18n.changeLanguage('en');
    expect(i18n.t('shoppingList.addItem')).toBe('Add item');
  });

  it('prefers and persists an explicit language selection', async () => {
    mockValues.set('fam:language', 'de');

    expect(getStoredLanguage()).toBe('de');
    expect(getInitialLanguage()).toBe('de');

    await setAppLanguage('en');

    expect(mockValues.get('fam:language')).toBe('en');
    expect(i18n.language).toBe('en');
  });
});
