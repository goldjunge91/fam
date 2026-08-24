import { explainCategory } from '../../../../src/features/shopping-list/classification/shopping-category-classifier';
import { normalizeShoppingName } from '../../../../src/features/shopping-list/classification/normalize-shopping-name';
import type { CanonicalCategoryId, EvaluationLabel, RuleProposal, RuleSignalType } from './types';

const STOP_WORDS = new Set(['aus', 'das', 'der', 'die', 'ein', 'eine', 'für', 'mit', 'oder', 'und', 'von', 'zum', 'zur']);
const MIN_MATCHES = 3;
const MIN_PRECISION = 0.8;

type Signal = { type: RuleSignalType; value: string };

function signalsFor(label: EvaluationLabel): Signal[] {
  const tokens = normalizeShoppingName(label.name).filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
  const unique = new Map<string, Signal>();
  for (const token of tokens) unique.set(`name_token:${token}`, { type: 'name_token', value: token });
  for (let index = 0; index + 1 < tokens.length; index++) {
    const value = `${tokens[index]} ${tokens[index + 1]}`;
    unique.set(`name_bigram:${value}`, { type: 'name_bigram', value });
  }
  for (const tag of label.categoryTags) {
    const value = tag.normalize('NFC').toLocaleLowerCase('en-US').trim();
    if (value) unique.set(`off_tag:${value}`, { type: 'off_tag', value });
  }
  return [...unique.values()];
}

function signalKey(signal: Signal): string {
  return `${signal.type}:${signal.value}`;
}

function wilsonLowerBound(correct: number, total: number): number {
  if (total === 0) return 0;
  const z = 1.96;
  const proportion = correct / total;
  const denominator = 1 + (z * z) / total;
  const center = proportion + (z * z) / (2 * total);
  const margin = z * Math.sqrt((proportion * (1 - proportion) + (z * z) / (4 * total)) / total);
  return (center - margin) / denominator;
}

function labeledGold(labels: readonly EvaluationLabel[], split: 'calibration' | 'holdout'): EvaluationLabel[] {
  return labels.filter((label) => label.split === split
    && label.status === 'labeled'
    && label.expectedCategoryId !== null
    && label.expectedProductFamilyId !== null
    && label.expectedProductFormId !== null
    && label.expectedPlacementZoneId !== null);
}

/**
 * Mines reviewable signals from Gold calibration labels. Holdout labels are
 * consulted only after a proposal exists and never influence its category.
 */
export function mineRuleProposals(labels: readonly EvaluationLabel[]): RuleProposal[] {
  const calibration = labeledGold(labels, 'calibration');
  const holdout = labeledGold(labels, 'holdout');
  if (calibration.length === 0) return [];

  const categoryTotals = new Map<CanonicalCategoryId, number>();
  const matches = new Map<string, { signal: Signal; labels: EvaluationLabel[] }>();
  for (const label of calibration) {
    const categoryId = label.expectedCategoryId as CanonicalCategoryId;
    categoryTotals.set(categoryId, (categoryTotals.get(categoryId) ?? 0) + 1);
    for (const signal of signalsFor(label)) {
      const key = signalKey(signal);
      const entry = matches.get(key) ?? { signal, labels: [] };
      entry.labels.push(label);
      matches.set(key, entry);
    }
  }

  const holdoutSignals = new Map<string, EvaluationLabel[]>();
  for (const label of holdout) {
    for (const signal of signalsFor(label)) {
      const key = signalKey(signal);
      holdoutSignals.set(key, [...(holdoutSignals.get(key) ?? []), label]);
    }
  }

  return [...matches.values()].flatMap(({ signal, labels: matched }) => {
    if (matched.length < MIN_MATCHES) return [];
    const counts = new Map<CanonicalCategoryId, number>();
    for (const label of matched) {
      const categoryId = label.expectedCategoryId as CanonicalCategoryId;
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    }
    const winner = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
    if (!winner) return [];
    const [categoryId, correct] = winner;
    const precision = correct / matched.length;
    if (precision < MIN_PRECISION) return [];

    const prior = (categoryTotals.get(categoryId) ?? 0) / calibration.length;
    const validation = holdoutSignals.get(signalKey(signal)) ?? [];
    const holdoutCorrect = validation.filter((label) => label.expectedCategoryId === categoryId).length;
    const currentClassifierErrors = matched.filter((label) => {
      const prediction = explainCategory({ name: label.name, categoryTags: label.categoryTags, source: 'dump' });
      return prediction.winner.categoryId !== categoryId;
    }).length;

    return [{
      signalType: signal.type,
      signal: signal.value,
      categoryId,
      calibrationMatches: matched.length,
      calibrationPrecision: precision,
      calibrationLift: prior > 0 ? precision / prior : 0,
      confidenceLowerBound: wilsonLowerBound(correct, matched.length),
      currentClassifierErrors,
      holdoutMatches: validation.length,
      holdoutPrecision: validation.length > 0 ? holdoutCorrect / validation.length : null,
      examples: matched.slice(0, 3).map((label) => label.name),
    }];
  }).sort((left, right) =>
    right.currentClassifierErrors - left.currentClassifierErrors
    || (right.holdoutPrecision ?? -1) - (left.holdoutPrecision ?? -1)
    || right.confidenceLowerBound - left.confidenceLowerBound
    || right.calibrationMatches - left.calibrationMatches);
}
