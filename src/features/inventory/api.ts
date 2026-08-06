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

export const DEFAULT_STORAGE_LOCATIONS = [
  { name: 'Kühlschrank', kind: 'fridge', sort_order: 0 },
  { name: 'Tiefkühltruhe', kind: 'freezer', sort_order: 1 },
  { name: 'Abstellkammer', kind: 'pantry', sort_order: 2 },
] as const;

export function useStorageLocations(householdId: string | undefined) {
  return useQuery({
    queryKey: ['storage_locations', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      const db = await getDatabase();
      const existing = await db.getAllAsync<StorageLocation>(
        'select id, household_id, name, kind, sort_order from storage_locations where household_id = ? and deleted_at is null order by sort_order',
        [householdId],
      );

      if (existing.length > 0) {
        return existing;
      }

      // Prüfe ob überhaupt jemals Daten für diesen Haushalt da waren
      const allRows = await db.getAllAsync<{ id: string }>(
        'select id from storage_locations where household_id = ? limit 1',
        [householdId],
      );

      if (allRows.length === 0) {
        // 3 Standard-Lagerorte automatisch anlegen
        for (const loc of DEFAULT_STORAGE_LOCATIONS) {
          const id = Crypto.randomUUID();
          const now = new Date().toISOString();
          const nowMs = Date.now();
          await enqueueMutation(db, {
            entity: 'storage_locations',
            entityId: id,
            op: 'insert',
            payload: {
              id,
              household_id: householdId,
              name: loc.name,
              kind: loc.kind,
              sort_order: loc.sort_order,
              created_at: now,
              updated_at: now,
            },
            applyLocally: async (txn) => {
              await txn.runAsync(
                'insert into storage_locations (id, household_id, name, kind, sort_order, created_at, updated_at, _dirty) values (?, ?, ?, ?, ?, ?, ?, 1)',
                [id, householdId, loc.name, loc.kind, loc.sort_order, now, nowMs],
              );
            },
          });
        }
        return db.getAllAsync<StorageLocation>(
          'select id, household_id, name, kind, sort_order from storage_locations where household_id = ? and deleted_at is null order by sort_order',
          [householdId],
        );
      }

      return existing;
    },
    enabled: !!householdId,
  });
}

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
                [id, householdId, locationId, item.name, item.quantity, item.unit, expDate, now, now],
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

export function normalizeUnit(rawUnit: string | undefined | null): string {
  if (!rawUnit) return 'piece';
  const u = rawUnit.toLowerCase().trim();
  if (u === 'l' || u === 'liter' || u === 'litre') return 'l';
  if (u === 'g' || u === 'gramm' || u === 'gram') return 'g';
  if (u === 'kg' || u === 'kilogramm' || u === 'kilo') return 'kg';
  if (u === 'ml' || u === 'milliliter') return 'ml';
  if (u === 'piece' || u === 'stk' || u === 'stk.' || u === 'stück' || u === 'stueck') return 'piece';
  if (u === 'package' || u === 'packung' || u === 'pkg') return 'package';
  if (u === 'portion' || u === 'pck') return 'portion';
  if (['g', 'kg', 'ml', 'l', 'piece', 'package', 'portion'].includes(u)) return u;
  return 'piece';
}

export function useAddFridgeItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Omit<FridgeItem, 'id'>) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const normUnit = normalizeUnit(item.unit);

      await enqueueMutation(db, {
        entity: 'fridge_items',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          ...item,
          unit: normUnit,
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
              normUnit,
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

export function useUpdateFridgeItemQuantityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      household_id,
      delta,
    }: {
      id: string;
      household_id: string;
      delta: number;
    }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const existing = await db.getFirstAsync<{ quantity: number; name: string }>(
        'select quantity, name from fridge_items where id = ?',
        [id],
      );
      if (!existing) return;

      const newQty = Math.max(0, existing.quantity + delta);

      if (newQty === 0) {
        await enqueueMutation(db, {
          entity: 'fridge_items',
          entityId: id,
          op: 'delete',
          payload: { id, household_id, deleted_at: now, updated_at: now },
          applyLocally: async (txn) => {
            await txn.runAsync('update fridge_items set deleted_at = ?, updated_at = ? where id = ?', [
              now,
              now,
              id,
            ]);
          },
        });
      } else {
        await enqueueMutation(db, {
          entity: 'fridge_items',
          entityId: id,
          op: 'update',
          payload: { id, household_id, quantity: newQty, updated_at: now },
          applyLocally: async (txn) => {
            await txn.runAsync('update fridge_items set quantity = ?, updated_at = ? where id = ?', [
              newQty,
              now,
              id,
            ]);
          },
        });
      }
      return { id, newQty };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useAddStorageLocationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      household_id,
      name,
      kind = 'pantry',
    }: {
      household_id: string;
      name: string;
      kind?: string;
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      const existing = await db.getAllAsync<{ sort_order: number }>(
        'select sort_order from storage_locations where household_id = ? order by sort_order desc limit 1',
        [household_id],
      );
      const nextSortOrder = (existing[0]?.sort_order ?? -1) + 1;

      await enqueueMutation(db, {
        entity: 'storage_locations',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          household_id,
          name,
          kind,
          sort_order: nextSortOrder,
          created_at: now,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'insert into storage_locations (id, household_id, name, kind, sort_order, created_at, updated_at, _dirty) values (?, ?, ?, ?, ?, ?, ?, 1)',
            [id, household_id, name, kind, nextSortOrder, now, nowMs],
          );
        },
      });

      return { id, name, household_id, kind, sort_order: nextSortOrder };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storage_locations', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateStorageLocationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      household_id,
      name,
    }: {
      id: string;
      household_id: string;
      name: string;
    }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      await enqueueMutation(db, {
        entity: 'storage_locations',
        entityId: id,
        op: 'update',
        payload: {
          id,
          household_id,
          name,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update storage_locations set name = ?, updated_at = ?, _dirty = 1 where id = ?',
            [name, nowMs, id],
          );
        },
      });

      return { id, name };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storage_locations', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useDeleteStorageLocationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, household_id }: { id: string; household_id: string }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      await enqueueMutation(db, {
        entity: 'storage_locations',
        entityId: id,
        op: 'delete',
        payload: {
          id,
          household_id,
          deleted_at: now,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update storage_locations set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
            [nowMs, nowMs, id],
          );
        },
      });

      return id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storage_locations', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
