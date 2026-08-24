import { describe, expect, it } from 'vitest';
import { mineRuleProposals } from './rule-miner';
import type { CanonicalCategoryId, EvaluationLabel, EvaluationSplit } from './types';

function label(id: number, name: string, categoryId: CanonicalCategoryId, split: EvaluationSplit): EvaluationLabel {
  return {
    id,
    reviewerId: 1,
    productKey: `product-${id}`,
    snapshotHash: `hash-${id}`,
    barcode: String(id),
    name,
    brand: null,
    quantity: null,
    categoryTags: [],
    split,
    expectedCategoryId: categoryId,
    status: 'labeled',
    note: null,
    classifierVersionAtLabel: 'test',
    originalPredictionCategoryId: null,
    originalPredictionSource: null,
    expectedProductFamilyId: categoryId === 'hot_beverages' ? 'tea' : categoryId === 'snacks' ? 'savory_snacks' : 'water_soft_drinks',
    expectedProductFormId: categoryId === 'beverages' ? 'ambient' : 'dry',
    expectedPlacementZoneId: categoryId === 'hot_beverages' ? 'hot_drinks' : categoryId === 'snacks' ? 'snacks' : 'cold_drinks',
    taxonomyVersionAtLabel: 'product-placement-v1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('mineRuleProposals', () => {
  it('learns from calibration and only validates on holdout', () => {
    const proposals = mineRuleProposals([
      label(1, 'Moringa Tee', 'hot_beverages', 'calibration'),
      label(2, 'Moringa Kräutertee', 'hot_beverages', 'calibration'),
      label(3, 'Moringa Aufguss', 'hot_beverages', 'calibration'),
      label(4, 'Moringa Getränk', 'beverages', 'holdout'),
    ]);
    const moringa = proposals.find((proposal) => proposal.signal === 'moringa');
    expect(moringa).toMatchObject({
      categoryId: 'hot_beverages',
      calibrationMatches: 3,
      calibrationPrecision: 1,
      holdoutMatches: 1,
      holdoutPrecision: 0,
    });
  });

  it('ignores weak one-off signals', () => {
    expect(mineRuleProposals([label(1, 'Seltenes Produkt', 'snacks', 'calibration')])).toEqual([]);
  });
});
