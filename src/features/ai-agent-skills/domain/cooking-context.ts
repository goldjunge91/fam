import type { PerishableInventoryContext } from './contracts';

export type InventoryPerishability = 'perishable' | 'non_perishable' | 'unknown';

export type InventoryStorage = 'fridge' | 'freezer' | 'pantry' | 'unknown';

/** Minimal, already tenant-scoped shape needed to build the cooking context. */
export type InventoryContextLot = {
  id: string;
  householdId: string;
  productId: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  expiryDate: string | null;
  useByDate: string | null;
  locationKind: InventoryStorage;
  perishability: InventoryPerishability;
  deletedAt: string | null;
};

export type BuildPerishableInventoryContextOptions = {
  householdId: string;
  fetchedAt: string;
};

function normalizeDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : value;
}

function compareNullableDate(a: string | null, b: string | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

/**
 * Builds the only ingredient context the cooking skill may receive.
 * Household scope, active state and perishability are enforced before any
 * model sees the data; unknown classifications are intentionally excluded.
 */
export function buildPerishableInventoryContext(
  lots: InventoryContextLot[],
  options: BuildPerishableInventoryContextOptions,
): PerishableInventoryContext {
  const selected = lots
    .filter(
      (lot) =>
        lot.householdId === options.householdId &&
        lot.deletedAt === null &&
        lot.perishability === 'perishable' &&
        (lot.quantity === null || lot.quantity > 0) &&
        lot.name.trim().length > 0,
    )
    .map((lot) => ({
      lotId: lot.id,
      productId: lot.productId,
      normalizedName: lot.name.trim(),
      quantity: lot.quantity,
      unit: lot.unit,
      bestBefore: normalizeDate(lot.expiryDate),
      useBy: normalizeDate(lot.useByDate),
      storage: lot.locationKind,
    }))
    .sort((a, b) => {
      const byDate = compareNullableDate(a.useBy ?? a.bestBefore, b.useBy ?? b.bestBefore);
      if (byDate !== 0) return byDate;

      const byName = a.normalizedName.localeCompare(b.normalizedName, 'de');
      return byName !== 0 ? byName : a.lotId.localeCompare(b.lotId);
    });

  return {
    source: 'inventory',
    fetchedAt: options.fetchedAt,
    lots: selected,
  };
}
