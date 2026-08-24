import { describe, expect, it } from 'vitest';
import { createEvaluationExport, parseEvaluationExport } from './import-export';
import type { EvaluationLabel } from './types';

const label: EvaluationLabel = {
  id: 1,
  reviewerId: 2,
  productKey: 'barcode:12345678',
  snapshotHash: 'a'.repeat(64),
  barcode: '12345678',
  name: 'Haferdrink',
  brand: 'Test',
  quantity: '1 l',
  categoryTags: ['en:oat-milks'],
  split: 'calibration',
  expectedCategoryId: 'plant_based',
  status: 'labeled',
  note: null,
  classifierVersionAtLabel: '1',
  originalPredictionCategoryId: 'dairy_eggs',
  originalPredictionSource: 'off_taxonomy',
  expectedProductFamilyId: 'plant_drink',
  expectedProductFormId: 'ambient',
  expectedPlacementZoneId: 'ambient_milk_drinks',
  taxonomyVersionAtLabel: 'product-placement-v1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('evaluation import/export', () => {
  it('exportiert nur portable Felder und liest sie wieder ein', () => {
    const exported = createEvaluationExport([label]);
    const parsed = parseEvaluationExport(JSON.parse(JSON.stringify(exported)));
    expect(parsed.labels).toHaveLength(1);
    expect(parsed.labels[0]).not.toHaveProperty('id');
    expect(parsed.labels[0]?.expectedCategoryId).toBe('plant_based');
    expect(parsed.labels[0]?.expectedPlacementZoneId).toBe('ambient_milk_drinks');
  });

  it('importiert alte Exporte ohne sie fälschlich als neue Gold-Taxonomie zu behandeln', () => {
    const exported = createEvaluationExport([label]) as unknown as Record<string, unknown>;
    exported.version = 1;
    const labels = (exported.labels as Record<string, unknown>[]);
    delete labels[0]?.expectedProductFamilyId;
    delete labels[0]?.expectedProductFormId;
    delete labels[0]?.expectedPlacementZoneId;
    delete labels[0]?.taxonomyVersionAtLabel;
    const parsed = parseEvaluationExport(exported);
    expect(parsed.labels[0]?.expectedProductFamilyId).toBeNull();
  });

  it('weist unbekannte Kategorien zurück', () => {
    const exported = createEvaluationExport([label]);
    exported.labels[0] = { ...exported.labels[0]!, expectedCategoryId: 'unknown' as 'plant_based' };
    expect(() => parseEvaluationExport(exported)).toThrow('keine bekannte Kategorie');
  });
});
