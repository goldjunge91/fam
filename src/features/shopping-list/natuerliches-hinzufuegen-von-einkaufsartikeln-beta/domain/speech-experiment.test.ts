import { getSpeechExperimentVariant } from './speech-experiment';

describe('getSpeechExperimentVariant', () => {
  it('defaults safely to baseline when no development variant is configured', () => {
    expect(getSpeechExperimentVariant(undefined)).toBe('baseline');
  });

  it('selects contextual strings only for the explicit allowlisted value', () => {
    expect(getSpeechExperimentVariant('contextual-strings')).toBe('contextual-strings');
    expect(getSpeechExperimentVariant('CONTEXTUAL-STRINGS')).toBe('baseline');
    expect(getSpeechExperimentVariant('unknown')).toBe('baseline');
  });
});
