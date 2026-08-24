import { describe, expect, it } from 'vitest';
import type { EvaluationLabel, EvaluationPrediction } from './types';
import { buildConfusionMatrix, compareEvaluationRuns, computeEvaluationMetrics } from './metrics';

function label(id: number, expectedCategoryId: EvaluationLabel['expectedCategoryId']): EvaluationLabel {
  return {
    id,
    reviewerId: 1,
    productKey: `barcode:${id}`,
    snapshotHash: 'a'.repeat(64),
    barcode: String(id).padStart(6, '0'),
    name: `Produkt ${id}`,
    brand: null,
    quantity: null,
    categoryTags: [],
    split: id % 2 === 0 ? 'holdout' : 'calibration',
    expectedCategoryId,
    status: 'labeled',
    note: null,
    classifierVersionAtLabel: '1',
    originalPredictionCategoryId: null,
    originalPredictionSource: null,
    expectedProductFamilyId: null,
    expectedProductFormId: null,
    expectedPlacementZoneId: null,
    taxonomyVersionAtLabel: null,
    createdAt: '2026-08-23T00:00:00Z',
    updatedAt: '2026-08-23T00:00:00Z',
  };
}

function prediction(
  labelId: number,
  predictedCategoryId: EvaluationPrediction['predictedCategoryId'],
): EvaluationPrediction {
  return {
    labelId,
    predictedCategoryId,
    predictionSource: predictedCategoryId ? 'name_fallback' : null,
    conflictReason: null,
    trace: {
      classifierVersion: '1',
      input: { source: 'dump', dataVersion: null, categoryTags: [], normalizedName: null },
      candidates: [],
      rejectedCandidates: [],
      winner: { categoryId: predictedCategoryId, source: predictedCategoryId ? 'name_fallback' : null, classifierVersion: '1' },
      conflictReason: null,
    },
  };
}

describe('computeEvaluationMetrics', () => {
  it('berechnet Accuracy, Coverage, Sonstiges-Fehler und Klassenmetriken', () => {
    const labels = [label(1, 'produce'), label(2, null), label(3, 'bakery')];
    const metrics = computeEvaluationMetrics(labels, [
      prediction(1, 'produce'),
      prediction(2, 'beverages'),
      prediction(3, null),
    ]);

    expect(metrics.accuracy).toBeCloseTo(1 / 3);
    expect(metrics.coverage).toBeCloseTo(2 / 3);
    expect(metrics.overclassifiedCount).toBe(1);
    expect(metrics.missedCount).toBe(1);
    expect(metrics.categoryMetrics.find((metric) => metric.categoryId === 'produce')).toMatchObject({
      precision: 1,
      recall: 1,
      support: 1,
    });
  });

  it('baut eine vollständige Matrix einschließlich Nullzellen', () => {
    const labels = [label(1, 'produce'), label(2, 'bakery')];
    const matrix = buildConfusionMatrix(computeEvaluationMetrics(labels, [
      prediction(1, 'produce'),
      prediction(2, 'produce'),
    ]));

    expect(matrix).toHaveLength(22);
    expect(matrix.find((row) => row.expected === 'bakery')?.counts.produce).toBe(1);
    expect(matrix.find((row) => row.expected === 'bakery')?.counts.frozen).toBe(0);
  });
});

describe('compareEvaluationRuns', () => {
  it('trennt Verbesserungen, Regressionen und Coverage-Aenderungen', () => {
    const labels = [label(1, 'produce'), label(2, 'bakery'), label(3, null)];
    const comparison = compareEvaluationRuns(
      labels,
      [prediction(1, null), prediction(2, 'bakery'), prediction(3, null)],
      [prediction(1, 'produce'), prediction(2, null), prediction(3, 'beverages')],
    );

    expect(comparison).toMatchObject({
      improved: 1,
      regressed: 2,
      newlyClassified: 2,
      newlyUnclassified: 1,
    });
    expect(comparison.changedLabelIds).toEqual([1, 2, 3]);
  });
});
