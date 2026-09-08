import {
  fromInventoryQuantityUnits,
  subtractInventoryQuantities,
  sumInventoryQuantities,
  toInventoryQuantityUnits,
} from '@/lib/inventory-quantity';

describe('inventory quantity precision', () => {
  it('berechnet aufeinanderfolgende Dezimalverbraeuche exakt in Tausendsteln', () => {
    const afterFirstConsumption = toInventoryQuantityUnits(1.1) - toInventoryQuantityUnits(1);
    const afterSecondConsumption = afterFirstConsumption - toInventoryQuantityUnits(0.1);

    expect(fromInventoryQuantityUnits(afterFirstConsumption)).toBe(0.1);
    expect(fromInventoryQuantityUnits(afterSecondConsumption)).toBe(0);
  });

  it('weist Mengen mit mehr als drei Nachkommastellen zurueck', () => {
    expect(() => toInventoryQuantityUnits(1.0001)).toThrow('drei Nachkommastellen');
  });

  it('summiert und subtrahiert Mengen ohne Float-Drift', () => {
    expect(sumInventoryQuantities([0.1, 0.2, 1])).toBe(1.3);
    expect(subtractInventoryQuantities(1.1, 1)).toBe(0.1);
  });
});
