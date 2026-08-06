import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { normalizeUnit } from '@/features/inventory/api';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';

type AddItemInput = {
  household_id: string;
  name: string;
  quantity: number;
  unit: string;
  category?: string | null;
  product_id?: string | null;
  sort_index?: number;
};

type ToggleItemInput = {
  id: string;
  household_id: string;
  /** `null` → unchecken, Timestamp-String → checken */
  checked_at: string | null;
  checked_by: string | null;
};

type DeleteItemInput = {
  id: string;
  household_id: string;
};

/**
 * Fuegt einen neuen Artikel zur Einkaufsliste hinzu (#86).
 *
 * Kein Server-Round-Trip noetig: UUID wird lokal generiert, Eintrag
 * landet sofort in SQLite und in der Outbox.
 */
export function useAddShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddItemInput) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const normUnit = normalizeUnit(input.unit);

      // sort_index: am Ende einfuegen
      const lastRow = await db.getFirstAsync<{ sort_index: number }>(
        'select sort_index from shopping_list_items where household_id = ? and deleted_at is null order by sort_index desc limit 1',
        [input.household_id],
      );
      const sortIndex = input.sort_index ?? (lastRow?.sort_index ?? -1) + 1;

      await enqueueMutation(db, {
        entity: 'shopping_list_items',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          household_id: input.household_id,
          product_id: input.product_id ?? null,
          name: input.name,
          quantity: input.quantity,
          unit: normUnit,
          category: input.category ?? null,
          sort_index: sortIndex,
          created_at: now,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            `insert into shopping_list_items
               (id, household_id, product_id, name, quantity, unit, category, sort_index, created_at, updated_at, _dirty)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              id,
              input.household_id,
              input.product_id ?? null,
              input.name,
              input.quantity,
              normUnit,
              input.category ?? null,
              sortIndex,
              now,
              nowMs,
            ],
          );
        },
      });

      return id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

/**
 * Checkt / uncheckt einen Artikel (#86).
 *
 * `checked_at` auf null setzen = unchecken.
 * `checked_at` auf ISO-String setzen = checken und `checked_by` mitschreiben.
 */
export function useToggleShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ToggleItemInput) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      await enqueueMutation(db, {
        entity: 'shopping_list_items',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          checked_at: input.checked_at,
          checked_by: input.checked_by,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update shopping_list_items set checked_at = ?, checked_by = ?, updated_at = ?, _dirty = 1 where id = ?',
            [input.checked_at, input.checked_by, nowMs, input.id],
          );
        },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.household_id] });
    },
  });
}

/**
 * Soft-deletes einen Einkaufslisten-Artikel (#86).
 *
 * Kein Hard-Delete: `deleted_at` setzen — Outbox-Push schreibt den
 * Tombstone nach Supabase, Realtime-Bridge propagiert zu anderen Geraeten.
 */
export function useDeleteShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteItemInput) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      await enqueueMutation(db, {
        entity: 'shopping_list_items',
        entityId: input.id,
        op: 'delete',
        payload: {
          id: input.id,
          household_id: input.household_id,
          deleted_at: now,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update shopping_list_items set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
            [nowMs, nowMs, input.id],
          );
        },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
