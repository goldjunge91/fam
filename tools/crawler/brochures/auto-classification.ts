export type AutomaticDecision =
  | 'identical'
  | 'regional-variant'
  | 'different'
  | 'uncertain';

export type AutomaticClassification = {
  decision: AutomaticDecision;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
};

type ComparisonSignals = {
  overallSimilarity: number;
  minimumPageSimilarity: number;
  samePageCount: boolean;
  ocrTextDifferentPages: number;
  regionCodeMatch?: boolean;
  automaticDifferenceThreshold: number;
};

/** Conservative classifier: only the human-calibrated 31/31 rule may auto-merge. */
export function classifyAutomaticComparison(
  signals: ComparisonSignals,
): AutomaticClassification {
  if (signals.overallSimilarity < signals.automaticDifferenceThreshold) {
    return {
      decision: 'different',
      confidence: 'high',
      reason: 'Gesamt-dHash liegt unter der automatischen Unterschiedsschwelle.',
    };
  }

  if (!signals.samePageCount) {
    return {
      decision: 'uncertain',
      confidence: 'low',
      reason: 'Die Anzahl der Angebotsseiten unterscheidet sich.',
    };
  }

  if (signals.regionCodeMatch === false) {
    return {
      decision: 'regional-variant',
      confidence: 'medium',
      reason: 'Die erkannten REWE-Regions-/Modulcodes unterscheiden sich.',
    };
  }

  if (
    signals.overallSimilarity >= 0.995 &&
    signals.minimumPageSimilarity >= 0.95 &&
    signals.ocrTextDifferentPages === 0
  ) {
    return {
      decision: 'identical',
      confidence: 'high',
      reason: 'Kalibrierte 31/31-Regel: dHash, Einzelseiten und OCR widersprechen sich nicht.',
    };
  }

  return {
    decision: 'uncertain',
    confidence: 'low',
    reason: 'Die Signale reichen ohne menschliche Annahmen nicht für eine sichere Zusammenlegung.',
  };
}
