import { render, screen, userEvent } from '@testing-library/react-native';

import { i18n, LANGUAGE_OVERRIDE_STORAGE_KEY } from '@/i18n';
import { LanguageOverrideControl } from './language-override-control';

const mockValues = new Map<string, string>();

jest.mock('@/lib/storage/device-storage', () => ({
  getDeviceStorage: () => ({
    getString: (key: string) => mockValues.get(key),
    remove: (key: string) => mockValues.delete(key),
    set: (key: string, value: string) => mockValues.set(key, value),
  }),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

describe('LanguageOverrideControl', () => {
  beforeEach(async () => {
    mockValues.clear();
    await i18n.changeLanguage('de');
  });

  it('starts on the device language by default', async () => {
    await render(<LanguageOverrideControl />);

    expect(screen.getByRole('radio', { name: 'Gerätesprache', selected: true })).toBeOnTheScreen();
  });

  it('persists a dev language override', async () => {
    await render(<LanguageOverrideControl />);
    const user = userEvent.setup();

    await user.press(screen.getByRole('radio', { name: 'Englisch' }));

    expect(screen.getByRole('radio', { name: 'Englisch', selected: true })).toBeOnTheScreen();
    expect(mockValues.get(LANGUAGE_OVERRIDE_STORAGE_KEY)).toBe('en');
    expect(i18n.language).toBe('en');
  });

  it('clears the override when the device language is selected', async () => {
    mockValues.set(LANGUAGE_OVERRIDE_STORAGE_KEY, 'de');
    await render(<LanguageOverrideControl />);
    const user = userEvent.setup();

    await user.press(screen.getByRole('radio', { name: 'Gerätesprache' }));

    expect(mockValues.get(LANGUAGE_OVERRIDE_STORAGE_KEY)).toBeUndefined();
    expect(i18n.language).toBe('en');
  });
});
