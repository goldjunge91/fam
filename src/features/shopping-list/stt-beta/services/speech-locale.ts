import { getLocales } from 'expo-localization';

export const FALLBACK_SPEECH_LOCALE = 'en-US' as const;

/** Returns the first locale selected in the device language preferences. */
export function getDeviceSpeechLocale(): string {
  const [preferredLocale] = getLocales();
  return preferredLocale?.languageTag ?? preferredLocale?.languageCode ?? FALLBACK_SPEECH_LOCALE;
}

/** Converts a BCP-47 locale into the language code expected by Whisper. */
export function speechLocaleToLanguageCode(locale: string): string {
  return locale.split(/[-_]/u, 1)[0]?.toLowerCase() || FALLBACK_SPEECH_LOCALE.slice(0, 2);
}
