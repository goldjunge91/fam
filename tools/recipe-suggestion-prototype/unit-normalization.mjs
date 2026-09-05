const UNIT_DEFINITIONS = new Map([
  ['g', { canonical: 'g', dimension: 'mass', factor: 1 }],
  ['kg', { canonical: 'g', dimension: 'mass', factor: 1000 }],
  ['ml', { canonical: 'ml', dimension: 'volume', factor: 1 }],
  ['l', { canonical: 'ml', dimension: 'volume', factor: 1000 }],
  ['pcs', { canonical: 'pcs', dimension: 'count', factor: 1 }],
  ['piece', { canonical: 'pcs', dimension: 'count', factor: 1 }],
  ['pack', { canonical: 'pack', dimension: 'package', factor: 1 }],
  ['package', { canonical: 'pack', dimension: 'package', factor: 1 }],
  ['dose', { canonical: 'dose', dimension: 'dose', factor: 1 }],
  ['portion', { canonical: 'portion', dimension: 'portion', factor: 1 }],
]);

function normalizeUnit(unit) {
  return typeof unit === 'string' ? unit.trim().toLocaleLowerCase('de-DE') : '';
}

export function normalizeMeasurement(quantity, unit) {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) return null;
  const definition = UNIT_DEFINITIONS.get(normalizeUnit(unit));
  if (!definition) return null;
  const normalizedQuantity = quantity * definition.factor;
  if (!Number.isFinite(normalizedQuantity)) return null;
  return {
    quantity: normalizedQuantity,
    dimension: definition.dimension,
    unit: definition.canonical,
  };
}
