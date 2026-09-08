import { useQuery } from '@tanstack/react-query';

import { getDatabase } from '@/lib/db/client';
import type { SqlDatabase, SqlParam } from '@/lib/db/types';

export type LocalInventoryItem = {
  id: string;
  household_id: string;
  location_id: string | null;
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  package_size: number | null;
  package_size_unit: string | null;
  expiry_date: string | null;
  opened_at?: string | null;
  vacuum_sealed?: boolean;
  expiry_user_set?: boolean;
  added_by: string | null;
  created_at: string;
  updated_at?: number | string | null;
  // JOIN-Felder aus storage_locations
  location_kind: string | null;
  location_name: string | null;
  deleted_at?: number | null;
};

/** Rohzeile wie von der fridge_items-Abfrage geliefert, vor der Persistenz-/View-Grenze. */
type RawFridgeItemRow = LocalInventoryItem;

/**
 * Persistenz-/View-Grenze fuer fridge_items (contract.md Abschnitt 3, fam-lem.30).
 * Solange quantity/package_size dezimal gespeichert sind, reicht diese Funktion sie
 * unveraendert durch. Sobald die Spalten auf Integer-Tausendstel umgestellt sind
 * (fam-lem.30.2/.30.3), wird ausschliesslich hier ueber fromInventoryQuantityUnits
 * konvertiert - das ist die einzige vorgesehene Aenderungsstelle.
 */
export function mapFridgeItemRow(row: RawFridgeItemRow): LocalInventoryItem {
  return row;
}

/**
 * Liest ein einzelnes fridge_items-Los inkl. Lagerort-Join. Einzige Quelle
 * dieser Abfrage (fam-lem.27.12) — vorher 5x fast identisch dupliziert
 * (dieser Hook + 4 Stellen in use-inventory-mutations.ts). `householdId`,
 * `excludeDeleted` und `excludeOpened` bilden genau die Filterkombinationen
 * ab, die die bisherigen Kopien tatsaechlich brauchten.
 */
export async function readFridgeItemRow(
  db: SqlDatabase,
  filter: {
    id: string;
    householdId?: string;
    excludeDeleted?: boolean;
    excludeOpened?: boolean;
  },
): Promise<LocalInventoryItem | null> {
  const conditions = ['fi.id = ?'];
  const params: SqlParam[] = [filter.id];
  if (filter.householdId !== undefined) {
    conditions.push('fi.household_id = ?');
    params.push(filter.householdId);
  }
  if (filter.excludeDeleted) conditions.push('fi.deleted_at is null');
  if (filter.excludeOpened) conditions.push('fi.opened_at is null');

  const row = await db.getFirstAsync<RawFridgeItemRow>(
    `select
       fi.id, fi.household_id, fi.location_id, fi.product_id,
       fi.name, fi.quantity, fi.unit, fi.package_size, fi.package_size_unit,
       fi.expiry_date, fi.opened_at, fi.vacuum_sealed, fi.expiry_user_set,
       fi.added_by, fi.created_at, fi.updated_at, fi.deleted_at,
       sl.kind as location_kind,
       sl.name as location_name
     from fridge_items fi
     left join storage_locations sl on fi.location_id = sl.id
     where ${conditions.join(' and ')}`,
    params,
  );
  return row === null ? null : mapFridgeItemRow(row);
}

export function useInventoryItems(householdId: string | undefined) {
  return useQuery({
    queryKey: ['fridge_items', householdId],
    queryFn: async (): Promise<LocalInventoryItem[]> => {
      if (!householdId) return [];

      const db = await getDatabase();
      const rows = await db.getAllAsync<RawFridgeItemRow>(
        `select
           fi.id, fi.household_id, fi.location_id, fi.product_id,
           fi.name, fi.quantity, fi.unit, fi.package_size, fi.package_size_unit,
           fi.expiry_date, fi.opened_at, fi.vacuum_sealed, fi.expiry_user_set,
           fi.added_by, fi.created_at, fi.updated_at,
           sl.kind as location_kind,
           sl.name as location_name
         from fridge_items fi
         left join storage_locations sl on fi.location_id = sl.id
         where fi.household_id = ? and fi.deleted_at is null
         order by fi.expiry_date asc nulls last`,
        [householdId],
      );
      return rows.map(mapFridgeItemRow);
    },
    enabled: !!householdId,
  });
}
