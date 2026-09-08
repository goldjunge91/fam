export const INVENTORY_QUANTITY_SCALE = 1_000;

/** Converts an inventory quantity to the canonical integer thousandths representation. */
export function toInventoryQuantityUnits(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    throw new Error('Bestandsmengen muessen endlich sein.');
  }

  const units = Math.round(quantity * INVENTORY_QUANTITY_SCALE);
  if (!Number.isSafeInteger(units) || units / INVENTORY_QUANTITY_SCALE !== quantity) {
    throw new Error('Bestandsmengen duerfen hoechstens drei Nachkommastellen haben.');
  }

  return units;
}

/** Converts canonical integer thousandths back to the persisted numeric representation. */
export function fromInventoryQuantityUnits(units: number): number {
  if (!Number.isSafeInteger(units)) {
    throw new Error('Bestandsmengen muessen in ganzzahligen Tausendsteln vorliegen.');
  }

  return units / INVENTORY_QUANTITY_SCALE;
}

export function sumInventoryQuantities(quantities: Iterable<number>): number {
  let totalUnits = 0;
  for (const quantity of quantities) {
    totalUnits += toInventoryQuantityUnits(quantity);
  }
  return fromInventoryQuantityUnits(totalUnits);
}

export function subtractInventoryQuantities(minuend: number, subtrahend: number): number {
  return fromInventoryQuantityUnits(
    toInventoryQuantityUnits(minuend) - toInventoryQuantityUnits(subtrahend),
  );
}
