import {
  DEFAULT_NATURAL_LANGUAGE_ADDITION_BETA_GATE,
  isNaturalLanguageAdditionBetaEnabled,
} from './gate';

describe('natural language addition beta gate', () => {
  test('is disabled by default', () => {
    expect(DEFAULT_NATURAL_LANGUAGE_ADDITION_BETA_GATE.enabled).toBe(false);
    expect(isNaturalLanguageAdditionBetaEnabled()).toBe(false);
  });

  test('only enables explicitly enabled beta configuration', () => {
    expect(isNaturalLanguageAdditionBetaEnabled({ enabled: false })).toBe(false);
    expect(isNaturalLanguageAdditionBetaEnabled({ enabled: true })).toBe(true);
  });
});
