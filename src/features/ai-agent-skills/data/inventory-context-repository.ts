import { and, eq, gt, isNull } from 'drizzle-orm';

import { getDrizzleDatabase } from '@/lib/db/client';
import { fridgeItems, products, storageLocations } from '@/lib/db/schemas';
import {
  buildPerishableInventoryContext,
  type InventoryContextLot,
} from '../domain/cooking-context';
import { classifyPerishability } from '../domain/perishability';

export type InventoryContextRow = {
  id: string;
  householdId: string;
  productId: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  expiryDate: string | null;
  deletedAt: string | number | null;
  locationKind: string | null;
  offCategoryTags: string | null;
};

function parseCategoryTags(serializedTags: string | null): string[] {
  if (!serializedTags) return [];

  try {
    const parsed: unknown = JSON.parse(serializedTags);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : [];
  } catch {
    return [];
  }
}

function normalizeStorageKind(value: string | null): InventoryContextLot['locationKind'] {
  if (value === 'fridge' || value === 'freezer' || value === 'pantry') return value;
  return 'unknown';
}

export function mapInventoryRowsToContextLots(rows: InventoryContextRow[]): InventoryContextLot[] {
  return rows.map((row) => ({
    id: row.id,
    householdId: row.householdId,
    productId: row.productId,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    expiryDate: row.expiryDate,
    useByDate: null,
    locationKind: normalizeStorageKind(row.locationKind),
    perishability: classifyPerishability(parseCategoryTags(row.offCategoryTags)),
    deletedAt: row.deletedAt === null ? null : String(row.deletedAt),
  }));
}

function requireHouseholdId(householdId: string): string {
  const normalized = householdId.trim();
  if (!normalized) throw new Error('Der Inventar-Kontext benötigt eine household_id.');
  return normalized;
}

/** Reads the local, already-authorized inventory projection for the cooking skill. */
export async function readPerishableInventoryContext(
  householdId: string,
  fetchedAt = new Date().toISOString(),
) {
  const normalizedHouseholdId = requireHouseholdId(householdId);
  const db = await getDrizzleDatabase();
  const rows = await db
    .select({
      id: fridgeItems.id,
      householdId: fridgeItems.householdId,
      productId: fridgeItems.productId,
      name: fridgeItems.name,
      quantity: fridgeItems.quantity,
      unit: fridgeItems.unit,
      expiryDate: fridgeItems.expiryDate,
      deletedAt: fridgeItems.deletedAt,
      locationKind: storageLocations.kind,
      offCategoryTags: products.offCategoryTags,
    })
    .from(fridgeItems)
    .leftJoin(storageLocations, eq(fridgeItems.locationId, storageLocations.id))
    .leftJoin(products, eq(fridgeItems.productId, products.id))
    .where(
      and(
        eq(fridgeItems.householdId, normalizedHouseholdId),
        isNull(fridgeItems.deletedAt),
        gt(fridgeItems.quantity, 0),
      ),
    );

  return buildPerishableInventoryContext(mapInventoryRowsToContextLots(rows), {
    householdId: normalizedHouseholdId,
    fetchedAt,
  });
}
