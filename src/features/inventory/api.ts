import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';

export type StorageLocation = {
  id: string;
  household_id: string;
  name: string;
  kind: string;
  sort_order: number;
};

export type FridgeItem = {
  id: string;
  household_id: string;
  location_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  expiry_date: string | null;
};

export function useStorageLocations(householdId: string | undefined) {
  return useQuery({
    queryKey: ['storage_locations', householdId],
    queryFn: async () => {
      const db = await getDatabase();
      return db.getAllAsync<StorageLocation>(
        'select id, household_id, name, kind, sort_order from storage_locations where household_id = ? and deleted_at is null order by sort_order',
        [householdId ?? ''],
      );
    },
    enabled: !!householdId,
  });
}

export function useFridgeItems(householdId: string | undefined) {
  return useQuery({
    queryKey: ['fridge_items', householdId],
    queryFn: async () => {
      const db = await getDatabase();
      return db.getAllAsync<FridgeItem>(
        'select id, household_id, location_id, name, quantity, unit, expiry_date from fridge_items where household_id = ? and deleted_at is null order by created_at desc',
        [householdId ?? ''],
      );
    },
    enabled: !!householdId,
  });
}

export function useAddFridgeItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Omit<FridgeItem, 'id'>) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();

      await enqueueMutation(db, {
        entity: 'fridge_items',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          ...item,
          created_at: now,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'insert into fridge_items (id, household_id, location_id, name, quantity, unit, expiry_date, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              id,
              item.household_id,
              item.location_id ?? null,
              item.name,
              item.quantity,
              item.unit,
              item.expiry_date ?? null,
              now,
              now,
            ],
          );
        },
      });

      return id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
