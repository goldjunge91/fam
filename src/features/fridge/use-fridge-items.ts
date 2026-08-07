import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';

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
      const items = await db.getAllAsync<LocalFridgeItem>(
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

      if (items.length > 0) return items;

      // Prüfe ob jemals Artikel da waren
      const allRows = await db.getAllAsync<{ id: string }>(
        'select id from fridge_items where household_id = ? limit 1',
        [householdId],
      );

      if (allRows.length === 0) {
        // Hol den ersten Lagerort
        const locations = await db.getAllAsync<{ id: string }>(
          'select id from storage_locations where household_id = ? and deleted_at is null order by sort_order limit 1',
          [householdId],
        );
        const locationId = locations[0]?.id ?? null;

        const sampleItems = [
          { name: 'Vollmilch', quantity: 1, unit: 'l', daysOffset: 2 },
          { name: 'Bio-Spinat', quantity: 200, unit: 'g', daysOffset: 1 },
          { name: 'Griechischer Joghurt', quantity: 500, unit: 'g', daysOffset: 6 },
          { name: 'Hähnchenbrust', quantity: 400, unit: 'g', daysOffset: 1 },
          { name: 'Gouda', quantity: 180, unit: 'g', daysOffset: 14 },
          { name: 'Orangen-Saft', quantity: 1, unit: 'l', daysOffset: 4 },
        ];

        for (const item of sampleItems) {
          const id = Crypto.randomUUID();
          const now = new Date().toISOString();
          const expDate = new Date(Date.now() + item.daysOffset * 86400000)
            .toISOString()
            .split('T')[0];

          await enqueueMutation(db, {
            entity: 'fridge_items',
            entityId: id,
            op: 'insert',
            payload: {
              id,
              household_id: householdId,
              location_id: locationId,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              expiry_date: expDate,
              created_at: now,
              updated_at: now,
            },
            applyLocally: async (txn) => {
              await txn.runAsync(
                'insert into fridge_items (id, household_id, location_id, name, quantity, unit, expiry_date, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                  id,
                  householdId,
                  locationId,
                  item.name,
                  item.quantity,
                  item.unit,
                  expDate,
                  now,
                  now,
                ],
              );
            },
          });
        }

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
      }

      return items;
    },
    enabled: !!householdId,
  });
}
