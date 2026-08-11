import { useQuery } from '@tanstack/react-query';

import { getDatabase } from '@/lib/db/client';

export type LocalFridgeItem = {
  id: string;
  household_id: string;
  location_id: string | null;
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  expiry_date: string | null;
  added_by: string | null;
  created_at: string;
  // JOIN-Felder aus storage_locations
  location_kind: string | null;
  location_name: string | null;
};

/**
 * Liest alle Vorrats-Artikel fuer den Haushalt aus SQLite, mit JOIN
 * auf `storage_locations` fuer Lagerort-Name und -Kind (#67).
 *
 * Sortierung: Ablaufdatum aufsteigend, NULL ans Ende — nutzt die
 * Bucket-Logik aus `expiry.ts` implizit (kritische Items stehen oben).
 */
export function useFridgeItems(householdId: string | undefined) {
  return useQuery({
    queryKey: ['fridge_items', householdId],
    queryFn: async (): Promise<LocalFridgeItem[]> => {
      if (!householdId) return [];

      const db = await getDatabase();
      return db.getAllAsync<LocalFridgeItem>(
        `select
           fi.id, fi.household_id, fi.location_id, fi.product_id,
           fi.name, fi.quantity, fi.unit, fi.expiry_date, fi.added_by, fi.created_at,
           sl.kind as location_kind,
           sl.name as location_name
         from fridge_items fi
         left join storage_locations sl on fi.location_id = sl.id
         where fi.household_id = ? and fi.deleted_at is null
         order by fi.expiry_date asc nulls last`,
        [householdId],
      );
    },
    enabled: !!householdId,
  });
}
