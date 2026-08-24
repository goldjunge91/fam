import type {
  CategoryMetric,
  ConfusionEntry,
  ConfusionMatrixRow,
  EvaluationClass,
  EvaluationLabel,
  EvaluationMetrics,
  EvaluationPrediction,
  RunComparison,
  SourceMetric,
} from './types';
import { CANONICAL_CATEGORY_IDS } from './types';

function evaluationClass(categoryId: string | null): EvaluationClass {
  return categoryId === null ? 'other' : (categoryId as EvaluationClass);
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function computeEvaluationMetrics(
  labels: readonly EvaluationLabel[],
  predictions: readonly EvaluationPrediction[],
): EvaluationMetrics {
  const predictionByLabel = new Map(predictions.map((prediction) => [prediction.labelId, prediction]));
  const scored = labels.filter((label) => label.status === 'labeled' && predictionByLabel.has(label.id));
  const classes: EvaluationClass[] = [...CANONICAL_CATEGORY_IDS, 'other'];
  const confusionMap = new Map<string, number>();
  const sourceMap = new Map<SourceMetric['source'], { count: number; correct: number }>([
    ['off_taxonomy', { count: 0, correct: 0 }],
    ['name_fallback', { count: 0, correct: 0 }],
    ['none', { count: 0, correct: 0 }],
  ]);

  let correctCount = 0;
  let classifiedCount = 0;
  let overclassifiedCount = 0;
  let missedCount = 0;

  for (const label of scored) {
    const prediction = predictionByLabel.get(label.id);
    if (!prediction) continue;
    const expected = evaluationClass(label.expectedCategoryId);
    const predicted = evaluationClass(prediction.predictedCategoryId);
    const isCorrect = expected === predicted;
    if (isCorrect) correctCount++;
    if (prediction.predictedCategoryId !== null) classifiedCount++;
    if (label.expectedCategoryId === null && prediction.predictedCategoryId !== null) overclassifiedCount++;
    if (label.expectedCategoryId !== null && prediction.predictedCategoryId === null) missedCount++;
    const confusionKey = `${expected}\u0000${predicted}`;
    confusionMap.set(confusionKey, (confusionMap.get(confusionKey) ?? 0) + 1);

    const source = prediction.predictionSource ?? 'none';
    const sourceBucket = sourceMap.get(source);
    if (sourceBucket) {
      sourceBucket.count++;
      if (isCorrect) sourceBucket.correct++;
    }
  }

  const confusion: ConfusionEntry[] = Array.from(confusionMap.entries(), ([key, count]) => {
    const [expected, predicted] = key.split('\u0000') as [EvaluationClass, EvaluationClass];
    return { expected, predicted, count };
  }).sort((a, b) => b.count - a.count || a.expected.localeCompare(b.expected));

  const categoryMetrics: CategoryMetric[] = classes.map((categoryId) => {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    let support = 0;
    for (const entry of confusion) {
      if (entry.expected === categoryId) support += entry.count;
      if (entry.expected === categoryId && entry.predicted === categoryId) truePositive += entry.count;
      else if (entry.expected !== categoryId && entry.predicted === categoryId) falsePositive += entry.count;
      else if (entry.expected === categoryId && entry.predicted !== categoryId) falseNegative += entry.count;
    }
    const precision = ratio(truePositive, truePositive + falsePositive);
    const recall = ratio(truePositive, truePositive + falseNegative);
    const f1 = precision === null || recall === null || precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);
    return { categoryId, truePositive, falsePositive, falseNegative, support, precision, recall, f1 };
  });

  const supportedF1 = categoryMetrics.flatMap((metric) => metric.f1 === null ? [] : [metric.f1]);
  const sourceMetrics: SourceMetric[] = Array.from(sourceMap.entries(), ([source, values]) => ({
    source,
    count: values.count,
    correct: values.correct,
    accuracy: ratio(values.correct, values.count),
  }));

  return {
    totalReviewed: labels.length,
    labeledCount: labels.filter((label) => label.status === 'labeled').length,
    ambiguousCount: labels.filter((label) => label.status === 'ambiguous').length,
    invalidCount: labels.filter((label) => label.status === 'invalid').length,
    calibrationCount: labels.filter((label) => label.status === 'labeled' && label.split === 'calibration').length,
    holdoutCount: labels.filter((label) => label.status === 'labeled' && label.split === 'holdout').length,
    correctCount,
    accuracy: ratio(correctCount, scored.length),
    coverage: ratio(classifiedCount, scored.length),
    macroF1: ratio(supportedF1.reduce((sum, value) => sum + value, 0), supportedF1.length),
    overclassifiedCount,
    missedCount,
    categoryMetrics,
    confusion,
    sourceMetrics,
  };
}

export function buildConfusionMatrix(metrics: EvaluationMetrics): ConfusionMatrixRow[] {
  const classes: EvaluationClass[] = [...CANONICAL_CATEGORY_IDS, 'other'];
  const counts = new Map(metrics.confusion.map((entry) => [`${entry.expected}\u0000${entry.predicted}`, entry.count]));
  return classes.map((expected) => {
    const row = Object.fromEntries(
      classes.map((predicted) => [predicted, counts.get(`${expected}\u0000${predicted}`) ?? 0]),
    ) as Record<EvaluationClass, number>;
    return { expected, counts: row, total: Object.values(row).reduce((sum, value) => sum + value, 0) };
  });
}

export function compareEvaluationRuns(
  labels: readonly EvaluationLabel[],
  baseline: readonly EvaluationPrediction[],
  candidate: readonly EvaluationPrediction[],
): RunComparison {
  const labelById = new Map(labels.filter((label) => label.status === 'labeled').map((label) => [label.id, label]));
  const baselineByLabel = new Map(baseline.map((prediction) => [prediction.labelId, prediction]));
  const candidateByLabel = new Map(candidate.map((prediction) => [prediction.labelId, prediction]));
  const result: RunComparison = {
    improved: 0,
    regressed: 0,
    newlyClassified: 0,
    newlyUnclassified: 0,
    unchangedCorrect: 0,
    unchangedWrong: 0,
    changedLabelIds: [],
  };

  for (const [labelId, label] of labelById) {
    const before = baselineByLabel.get(labelId);
    const after = candidateByLabel.get(labelId);
    if (!before || !after) continue;
    const expected = label.expectedCategoryId;
    const beforeCorrect = before.predictedCategoryId === expected;
    const afterCorrect = after.predictedCategoryId === expected;
    if (before.predictedCategoryId !== after.predictedCategoryId) result.changedLabelIds.push(labelId);
    if (!beforeCorrect && afterCorrect) result.improved++;
    else if (beforeCorrect && !afterCorrect) result.regressed++;
    else if (beforeCorrect) result.unchangedCorrect++;
    else result.unchangedWrong++;
    if (before.predictedCategoryId === null && after.predictedCategoryId !== null) result.newlyClassified++;
    if (before.predictedCategoryId !== null && after.predictedCategoryId === null) result.newlyUnclassified++;
  }

  return result;
}
