import { describe, expect, it } from '@jest/globals';
import { classifyAutomaticComparison } from './auto-classification';

const baseSignals = {
  overallSimilarity: 0.999,
  minimumPageSimilarity: 0.98,
  samePageCount: true,
  ocrTextDifferentPages: 0,
  automaticDifferenceThreshold: 0.82,
};

describe('Automatische Prospektklassifikation', () => {
  it('legt nur die kalibrierte sichere Kombination automatisch zusammen', () => {
    expect(classifyAutomaticComparison(baseSignals)).toMatchObject({
      decision: 'identical',
      confidence: 'high',
    });
  });

  it('verhindert Auto-Merges bei einer einzelnen deutlich abweichenden Seite', () => {
    expect(
      classifyAutomaticComparison({ ...baseSignals, minimumPageSimilarity: 0.921875 }),
    ).toMatchObject({ decision: 'uncertain' });
  });

  it('erkennt abweichende REWE-Codes als regionale Variante', () => {
    expect(
      classifyAutomaticComparison({ ...baseSignals, regionCodeMatch: false }),
    ).toMatchObject({ decision: 'regional-variant', confidence: 'medium' });
  });

  it('trennt klar unähnliche Prospekte automatisch', () => {
    expect(
      classifyAutomaticComparison({ ...baseSignals, overallSimilarity: 0.6 }),
    ).toMatchObject({ decision: 'different', confidence: 'high' });
  });
});
