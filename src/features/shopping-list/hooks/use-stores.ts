import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import { serializeCategoryOrder } from '../domain-logik/shopping-categories';

export type Store = {
  id: string;
  household_id: string;
  name: string;
  color: string;
  sort_order: number;
  /** Kommagetrennte Kategorie-IDs, per Drag&Drop editiert — siehe shopping-categories.ts. */
  category_order: string | null;
};

/** Vergleicht Marktnamen getrimmt und ohne Beachtung der Grossschreibung. */
export function findStoreByName(stores: readonly Store[], name: string): Store | undefined {
  const normalized = name.trim().toLowerCase();
  return stores.find((s) => s.name.trim().toLowerCase() === normalized);
}

export function useStores(householdId: string | undefined) {
  return useQuery({
    queryKey: ['stores', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      const db = await getDatabase();
      return db.getAllAsync<Store>(
        'select id, household_id, name, color, sort_order, category_order from stores where household_id = ? and deleted_at is null order by sort_order',
        [householdId],
      );
    },
    enabled: !!householdId,
  });
}

export function useAddStoreMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      household_id,
      name,
      color,
    }: {
      household_id: string;
      name: string;
      color: string;
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      const existing = await db.getAllAsync<{ sort_order: number }>(
        'select sort_order from stores where household_id = ? order by sort_order desc limit 1',
        [household_id],
      );
      const nextSortOrder = (existing[0]?.sort_order ?? -1) + 1;

      await enqueueMutation(db, {
        entity: 'stores',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          household_id,
          name,
          color,
          sort_order: nextSortOrder,
          created_at: now,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'insert into stores (id, household_id, name, color, sort_order, created_at, updated_at, _dirty) values (?, ?, ?, ?, ?, ?, ?, 1)',
            [id, household_id, name, color, nextSortOrder, now, nowMs],
          );
        },
      });

      return { id, name, household_id, color, sort_order: nextSortOrder };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stores', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateStoreMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      household_id,
      name,
      color,
    }: {
      id: string;
      household_id: string;
      name: string;
      color: string;
    }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      await enqueueMutation(db, {
        entity: 'stores',
        entityId: id,
        op: 'update',
        payload: {
          id,
          household_id,
          name,
          color,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update stores set name = ?, color = ?, updated_at = ?, _dirty = 1 where id = ?',
            [name, color, nowMs, id],
          );
        },
      });

      return { id, name, color };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stores', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

/** Speichert die Laufstrecke separat von den uebrigen Markt-Eigenschaften. */
export function useSetStoreCategoryOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      household_id,
      categoryOrder,
    }: {
      id: string;
      household_id: string;
      categoryOrder: readonly string[];
    }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const serialized = serializeCategoryOrder(categoryOrder);

      await enqueueMutation(db, {
        entity: 'stores',
        entityId: id,
        op: 'update',
        payload: {
          id,
          household_id,
          category_order: serialized,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update stores set category_order = ?, updated_at = ?, _dirty = 1 where id = ?',
            [serialized, nowMs, id],
          );
        },
      });

      return { id, categoryOrder };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stores', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useDeleteStoreMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, household_id }: { id: string; household_id: string }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      await enqueueMutation(db, {
        entity: 'stores',
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
            'update stores set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
            [nowMs, nowMs, id],
          );
        },
      });

      return id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stores', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
