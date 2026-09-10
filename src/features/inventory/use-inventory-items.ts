import { useQuery } from '@tanstack/react-query';

import { getDatabase } from '@/lib/db/client';

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
  // Gesetzt, sobald das Los geoeffnet wurde; unterscheidet versiegelte von offenen Losen.
  opened_at: string | null;
  // Lifecycle-Flags des Loses; die Query-Grenze liefert sie als echte Booleans.
  vacuum_sealed: boolean;
  expiry_user_set: boolean;
  added_by: string | null;
  created_at: string;
  // JOIN-Felder aus storage_locations
  location_kind: string | null;
  location_name: string | null;
};

// SQLite kennt keinen Boolean-Typ und liefert die Lifecycle-Flags als 0/1.
type LocalInventoryItemRow = Omit<LocalInventoryItem, 'vacuum_sealed' | 'expiry_user_set'> & {
  vacuum_sealed: boolean | number;
  expiry_user_set: boolean | number;
};

export function useInventoryItems(householdId: string | undefined) {
  return useQuery({
    queryKey: ['fridge_items', householdId],
    queryFn: async (): Promise<LocalInventoryItem[]> => {
      if (!householdId) return [];

      const db = await getDatabase();
      const rows = await db.getAllAsync<LocalInventoryItemRow>(
        `select
           fi.id, fi.household_id, fi.location_id, fi.product_id,
           fi.name, fi.quantity, fi.unit, fi.package_size, fi.package_size_unit,
           fi.expiry_date, fi.opened_at, fi.vacuum_sealed, fi.expiry_user_set,
           fi.added_by, fi.created_at,
           sl.kind as location_kind,
           sl.name as location_name
         from fridge_items fi
         left join storage_locations sl on fi.location_id = sl.id
         where fi.household_id = ? and fi.deleted_at is null
         order by fi.expiry_date asc nulls last`,
        [householdId],
      );
      return rows.map((row) => ({
        ...row,
        vacuum_sealed: row.vacuum_sealed === true || row.vacuum_sealed === 1,
        expiry_user_set: row.expiry_user_set === true || row.expiry_user_set === 1,
      }));
    },
    enabled: !!householdId,
  });
}
