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
