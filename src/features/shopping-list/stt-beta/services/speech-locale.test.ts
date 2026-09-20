import { getLocales } from 'expo-localization';

import {
  FALLBACK_SPEECH_LOCALE,
  getDeviceSpeechLocale,
  speechLocaleToLanguageCode,
} from './speech-locale';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
}));

const mockGetLocales = jest.mocked(getLocales);

describe('speech locale', () => {
  beforeEach(() => {
    mockGetLocales.mockReset();
  });

  it('uses the first device locale for native speech', () => {
    mockGetLocales.mockReturnValue([
      { languageTag: 'de-DE', languageCode: 'de' } as unknown as ReturnType<
        typeof getLocales
      >[number],
    ]);

    expect(getDeviceSpeechLocale()).toBe('de-DE');
  });

  it('falls back to the device language code when no tag is available', () => {
    mockGetLocales.mockReturnValue([
      { languageTag: null, languageCode: 'fr' } as unknown as ReturnType<typeof getLocales>[number],
    ]);

    expect(getDeviceSpeechLocale()).toBe('fr');
  });

  it('has a safe fallback when localization data is unavailable', () => {
    mockGetLocales.mockReturnValue([] as unknown as ReturnType<typeof getLocales>);

    expect(getDeviceSpeechLocale()).toBe(FALLBACK_SPEECH_LOCALE);
  });

  it.each([
    ['de-DE', 'de'],
    ['en_US', 'en'],
    ['fr', 'fr'],
  ])('converts %s to the Whisper language code %s', (locale, expected) => {
    expect(speechLocaleToLanguageCode(locale)).toBe(expected);
  });
});
