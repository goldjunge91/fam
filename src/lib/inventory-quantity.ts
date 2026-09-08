export const INVENTORY_QUANTITY_SCALE = 1_000;

/** Fachlicher Maximalwert 9_999_999.999, in Integer-Tausendsteln (contract.md Abschnitt 3). */
export const MAX_INVENTORY_QUANTITY_UNITS = 9_999_999_999;

/** Prueft eine bereits skalierte Menge (Integer-Tausendstel) auf positive Ganzzahligkeit innerhalb der Grenze. */
export function isPositiveIntegerThousandths(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_INVENTORY_QUANTITY_UNITS
  );
}

/** Wie isPositiveIntegerThousandths, erlaubt zusaetzlich 0 (z. B. aufgebrauchte Lose). */
export function isNonNegativeIntegerThousandths(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_INVENTORY_QUANTITY_UNITS
  );
}

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

/**
 * Prueft eine aus einem Payload gelesene Menge auf Integer-Tausendstel-Praezision
 * und gibt sie unveraendert zurueck; weist Ueberpraezision ab statt zu runden
 * (contract.md Abschnitt 3). Einziger Owner dieses Roundtrips.
 */
export function assertInventoryQuantityPrecision(value: number): number {
  return fromInventoryQuantityUnits(toInventoryQuantityUnits(value));
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
