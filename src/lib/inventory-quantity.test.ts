import {
  assertInventoryQuantityPrecision,
  fromInventoryQuantityUnits,
  isNonNegativeIntegerThousandths,
  isPositiveIntegerThousandths,
  MAX_INVENTORY_QUANTITY_UNITS,
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

  it('assertInventoryQuantityPrecision gibt gueltige Mengen unveraendert zurueck', () => {
    expect(assertInventoryQuantityPrecision(1.5)).toBe(1.5);
    expect(assertInventoryQuantityPrecision(0)).toBe(0);
  });

  it('assertInventoryQuantityPrecision weist Ueberpraezision zurueck statt zu runden', () => {
    expect(() => assertInventoryQuantityPrecision(1.0001)).toThrow('drei Nachkommastellen');
  });
});

describe('inventory quantity bounds (contract.md Abschnitt 3)', () => {
  it('isPositiveIntegerThousandths validiert positive Ganzzahlen innerhalb der Grenze', () => {
    expect(isPositiveIntegerThousandths(1_000)).toBe(true);
    expect(isPositiveIntegerThousandths(300_000)).toBe(true);
    expect(isPositiveIntegerThousandths(MAX_INVENTORY_QUANTITY_UNITS)).toBe(true);
    expect(isPositiveIntegerThousandths(0)).toBe(false);
    expect(isPositiveIntegerThousandths(-1)).toBe(false);
    expect(isPositiveIntegerThousandths(1.5)).toBe(false);
    expect(isPositiveIntegerThousandths(MAX_INVENTORY_QUANTITY_UNITS + 1)).toBe(false);
    expect(isPositiveIntegerThousandths('100')).toBe(false);
  });

  it('isNonNegativeIntegerThousandths erlaubt null, weist negativ und Bruchzahlen zurueck', () => {
    expect(isNonNegativeIntegerThousandths(0)).toBe(true);
    expect(isNonNegativeIntegerThousandths(1_000)).toBe(true);
    expect(isNonNegativeIntegerThousandths(MAX_INVENTORY_QUANTITY_UNITS)).toBe(true);
    expect(isNonNegativeIntegerThousandths(MAX_INVENTORY_QUANTITY_UNITS + 1)).toBe(false);
    expect(isNonNegativeIntegerThousandths(-1)).toBe(false);
    expect(isNonNegativeIntegerThousandths(0.5)).toBe(false);
  });
});
