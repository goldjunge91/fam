export type InventoryOutcomeUnit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'piece'
  | 'package'
  | 'portion';

export type InventoryOutcomeTelemetry =
  | { quantity_known: true; quantity: number; unit: InventoryOutcomeUnit }
  | { quantity_known: false };

const OUTCOME_UNITS: ReadonlySet<string> = new Set([
  'g',
  'kg',
  'ml',
  'l',
  'piece',
  'package',
  'portion',
]);

/** Keeps outcome telemetry quantitative without sending inventory identity or text. */
export function buildInventoryOutcomeTelemetry(
  quantity: number,
  unit: string,
): InventoryOutcomeTelemetry {
  if (!Number.isFinite(quantity) || quantity <= 0 || !OUTCOME_UNITS.has(unit)) {
    return { quantity_known: false };
  }

  return {
    quantity_known: true,
    quantity,
    unit: unit as InventoryOutcomeUnit,
  };
}
