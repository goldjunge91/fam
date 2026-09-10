export const MAX_INVENTORY_QUANTITY = 9_999_999.9;

const DECIMAL_PLACES = 1;

function hasAllowedPrecision(value: number): boolean {
  return Number.isInteger(value * 10 ** DECIMAL_PLACES);
}

function assertValidInventoryQuantity(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Bestandsmengen muessen endlich sein.');
  }

  if (value < 0) {
    throw new Error('Bestandsmengen duerfen nicht negativ sein.');
  }

  if (value > MAX_INVENTORY_QUANTITY) {
    throw new Error('Bestandsmengen duerfen den Maximalwert nicht ueberschreiten.');
  }

  if (!hasAllowedPrecision(value)) {
    throw new Error('Bestandsmengen duerfen hoechstens eine Nachkommastelle haben.');
  }
}

export function isPositiveInventoryQuantity(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_INVENTORY_QUANTITY &&
    hasAllowedPrecision(value)
  );
}

export function isNonNegativeInventoryQuantity(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_INVENTORY_QUANTITY &&
    hasAllowedPrecision(value)
  );
}

export function normalizeInventoryQuantity(value: unknown): number {
  assertValidInventoryQuantity(value);
  return value === 0 ? 0 : value;
}

export function sumInventoryQuantities(quantities: Iterable<number>): number {
  let totalTenths = 0;

  for (const quantity of quantities) {
    const normalizedQuantity = normalizeInventoryQuantity(quantity);
    totalTenths += normalizedQuantity * 10;

    if (totalTenths > MAX_INVENTORY_QUANTITY * 10) {
      throw new Error('Bestandsmengen duerfen den Maximalwert nicht ueberschreiten.');
    }
  }

  return totalTenths / 10;
}

export function subtractInventoryQuantities(minuend: number, subtrahend: number): number {
  const normalizedMinuend = normalizeInventoryQuantity(minuend);
  const normalizedSubtrahend = normalizeInventoryQuantity(subtrahend);
  const resultTenths = normalizedMinuend * 10 - normalizedSubtrahend * 10;

  if (resultTenths < 0) {
    throw new Error('Bestandsmengen duerfen nicht negativ werden.');
  }

  return resultTenths === 0 ? 0 : resultTenths / 10;
}

export function adjustInventoryQuantity(current: number, delta: number): number {
  if (delta >= 0) return sumInventoryQuantities([current, delta]);
  return subtractInventoryQuantities(current, -delta);
}
