export const NATURAL_LANGUAGE_ADDITION_BETA_ID = 'natural_language_addition_beta' as const;

export type NaturalLanguageAdditionBetaGate = {
  readonly id: typeof NATURAL_LANGUAGE_ADDITION_BETA_ID;
  readonly enabled: boolean;
};

export const DEFAULT_NATURAL_LANGUAGE_ADDITION_BETA_GATE = {
  id: NATURAL_LANGUAGE_ADDITION_BETA_ID,
  enabled: false,
} as const satisfies NaturalLanguageAdditionBetaGate;

export function isNaturalLanguageAdditionBetaEnabled(
  gate: Pick<
    NaturalLanguageAdditionBetaGate,
    'enabled'
  > = DEFAULT_NATURAL_LANGUAGE_ADDITION_BETA_GATE,
): boolean {
  return gate.enabled;
}
