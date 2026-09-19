export type ExperimentVariant = 'baseline' | 'contextual-strings';

export function isSpeechExperimentVariant(value: unknown): value is ExperimentVariant {
  return value === 'baseline' || value === 'contextual-strings';
}

/**
 * Expo inlines statically referenced EXPO_PUBLIC_ variables into the dev bundle.
 * Source: https://docs.expo.dev/guides/environment-variables/
 */
export function getSpeechExperimentVariant(
  configuredValue = process.env.EXPO_PUBLIC_NATURAL_LANGUAGE_ADDITION_SPEECH_VARIANT,
): ExperimentVariant {
  return configuredValue?.trim() === 'contextual-strings' ? 'contextual-strings' : 'baseline';
}
