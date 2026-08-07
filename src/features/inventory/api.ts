import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import type { FridgeItem } from '@/features/fridge/use-fridge-mutations';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';

export function useFridgeItems(householdId: string | undefined) {
  return useQuery({
    queryKey: ['fridge_items', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      const db = await getDatabase();
      const existing = await db.getAllAsync<FridgeItem>(
        'select id, household_id, location_id, name, quantity, unit, expiry_date from fridge_items where household_id = ? and deleted_at is null order by created_at desc',
        [householdId],
      );

      if (existing.length > 0) return existing;

      // Prüfe ob jemals Artikel da waren
      const allRows = await db.getAllAsync<{ id: string }>(
        'select id from fridge_items where household_id = ? limit 1',
        [householdId],
      );

      if (allRows.length === 0) {
        // Hol den Kühlschrank-Lagerort
        const locations = await db.getAllAsync<{ id: string }>(
          'select id from storage_locations where household_id = ? and deleted_at is null limit 1',
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

        return db.getAllAsync<FridgeItem>(
          'select id, household_id, location_id, name, quantity, unit, expiry_date from fridge_items where household_id = ? and deleted_at is null order by created_at desc',
          [householdId],
        );
      }

      return existing;
    },
    enabled: !!householdId,
  });
}
