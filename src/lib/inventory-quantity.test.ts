import {
  isNonNegativeInventoryQuantity,
  isPositiveInventoryQuantity,
  MAX_INVENTORY_QUANTITY,
  normalizeInventoryQuantity,
  subtractInventoryQuantities,
  sumInventoryQuantities,
} from '@/lib/inventory-quantity';

describe('inventory quantity boundary (contract.md Abschnitt 3)', () => {
  it('accepts persisted decimal quantities with at most one decimal place', () => {
    expect(isPositiveInventoryQuantity(0.1)).toBe(true);
    expect(isPositiveInventoryQuantity(0.5)).toBe(true);
    expect(isPositiveInventoryQuantity(300)).toBe(true);
    expect(isPositiveInventoryQuantity(MAX_INVENTORY_QUANTITY)).toBe(true);
  });

  it('rejects zero, overprecision, non-finite values and values above the maximum', () => {
    expect(isPositiveInventoryQuantity(0)).toBe(false);
    expect(isPositiveInventoryQuantity(-0.1)).toBe(false);
    expect(isPositiveInventoryQuantity(0.01)).toBe(false);
    expect(isPositiveInventoryQuantity(0.05)).toBe(false);
    expect(isPositiveInventoryQuantity(1.11)).toBe(false);
    expect(isPositiveInventoryQuantity(MAX_INVENTORY_QUANTITY + 0.1)).toBe(false);
    expect(isPositiveInventoryQuantity(Number.NaN)).toBe(false);
    expect(isPositiveInventoryQuantity(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isPositiveInventoryQuantity('0.5')).toBe(false);
  });

  it('allows zero only at the non-negative boundary', () => {
    expect(isNonNegativeInventoryQuantity(0)).toBe(true);
    expect(isNonNegativeInventoryQuantity(0.5)).toBe(true);
    expect(isNonNegativeInventoryQuantity(-0.1)).toBe(false);
    expect(isNonNegativeInventoryQuantity(0.05)).toBe(false);
  });

  it('normalizes valid values without scaling or rounding invalid precision', () => {
    expect(normalizeInventoryQuantity(300)).toBe(300);
    expect(normalizeInventoryQuantity(0.5)).toBe(0.5);
    expect(normalizeInventoryQuantity(-0)).toBe(0);
    expect(() => normalizeInventoryQuantity(0.05)).toThrow('Nachkommastelle');
    expect(() => normalizeInventoryQuantity(MAX_INVENTORY_QUANTITY + 0.1)).toThrow('Maximalwert');
  });
});

describe('inventory quantity arithmetic', () => {
  it('sums valid decimal quantities without floating-point drift', () => {
    expect(sumInventoryQuantities([0.1, 0.2, 1])).toBe(1.3);
    expect(sumInventoryQuantities([300, 0.5])).toBe(300.5);
    expect(sumInventoryQuantities([])).toBe(0);
  });

  it('rejects a sum above the persisted maximum', () => {
    expect(() => sumInventoryQuantities([MAX_INVENTORY_QUANTITY, 0.1])).toThrow('Maximalwert');
  });

  it('subtracts exactly and rejects a negative persisted result', () => {
    expect(subtractInventoryQuantities(1.1, 1)).toBe(0.1);
    expect(subtractInventoryQuantities(0.5, 0.5)).toBe(0);
    expect(() => subtractInventoryQuantities(0.5, 0.6)).toThrow('negativ');
  });
});
