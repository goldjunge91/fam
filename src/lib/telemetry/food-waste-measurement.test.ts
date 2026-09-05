import { calculateWasteOutcomeMetrics } from './food-waste-measurement';

describe('food waste measurement', () => {
  it('converts only compatible units for the primary rescue ratio', () => {
    const result = calculateWasteOutcomeMetrics([
      {
        outcomeKey: 'opaque-1',
        consumed: { quantity: 1, unit: 'kg' },
        wasted: { quantity: 500, unit: 'g' },
      },
    ]);

    expect(result.primaryRescueRatio).toBeCloseTo(2 / 3);
    expect(result.rescueRatioByDimension.mass).toBeCloseTo(2 / 3);
  });

  it('excludes unknown quantities and keeps incompatible dimensions separate', () => {
    const result = calculateWasteOutcomeMetrics([
      {
        outcomeKey: 'unknown',
        consumed: null,
        wasted: { quantity: 1, unit: 'piece' },
      },
      {
        outcomeKey: 'incompatible',
        consumed: { quantity: 1, unit: 'kg' },
        wasted: { quantity: 1, unit: 'piece' },
      },
    ]);

    expect(result.primaryRescueRatio).toBeNull();
    expect(result.rescueRatioByDimension).toEqual({ count: 0 });
    expect(result.knownOutcomeLotCount).toBe(2);
    expect(result.plausibilityRatio).toBe(0);
  });

  it('keeps the coarse plausibility check separate from the primary quantity metric', () => {
    const result = calculateWasteOutcomeMetrics([
      { outcomeKey: 'rescued', consumed: { quantity: 2, unit: 'piece' }, wasted: null },
      { outcomeKey: 'wasted', consumed: null, wasted: { quantity: 1, unit: 'piece' } },
      { outcomeKey: 'unknown', consumed: null, wasted: null },
    ]);

    expect(result.primaryRescueRatio).toBeCloseTo(2 / 3);
    expect(result.knownOutcomeLotCount).toBe(2);
    expect(result.rescuedLotCount).toBe(1);
    expect(result.plausibilityRatio).toBe(0.5);
  });
});
