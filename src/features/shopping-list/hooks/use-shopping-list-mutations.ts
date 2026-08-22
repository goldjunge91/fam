import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import {
  type AddShoppingItemInput as AddItemInput,
  addOrMergeShoppingItem,
} from '@/lib/db/shopping-list-merge';
import { normalizeUnit } from '@/lib/units';

type UpdateItemInput = {
  id: string;
  household_id: string;
  name: string;
  quantity: number;
  unit: string;
  package_size?: number | null;
  package_size_unit?: string | null;
  category_id: string | null;
  category_source: 'user' | 'household_preference' | 'off_taxonomy' | 'name_fallback' | null;
  category_classifier_version: string | null;
  store_id: string | null;
  price_estimate: number | null;
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
 * Fuegt einen neuen Artikel zur Einkaufsliste hinzu (#86) — oder erhoeht,
 * falls derselbe Artikel (gleiches Produkt bzw. gleicher Name, gleiche
 * Einheit) bereits offen auf der Liste steht, dessen Menge (#131/#146).
 * Verhindert Duplikate unabhaengig von der Quelle: manueller Eintrag,
 * Wochenplaner-Bedarf oder Rezept. Die eigentliche Merge-Logik steckt in
 * `@/lib/db/shopping-list-merge`, damit sie ohne `expo-crypto`/`expo-sqlite`
 * gegen eine echte SQLite-Instanz testbar ist.
 *
 * Kein Server-Round-Trip noetig: UUID wird lokal generiert, Eintrag
 * landet sofort in SQLite und in der Outbox.
 */
export function useAddShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddItemInput) => {
      const db = await getDatabase();
      return addOrMergeShoppingItem(db, Crypto.randomUUID(), input);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

/**
 * Bearbeitet einen bestehenden Artikel — bislang vor allem fuer die
 * Marktzuordnung gedacht (ein Artikel ohne Markt liess sich bisher gar nicht
 * mehr aendern), deckt aber alle Felder aus dem Formular ab, weil dort noch
 * weitere Punkte dazukommen werden.
 */
export function useUpdateShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateItemInput) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const normUnit = normalizeUnit(input.unit);
      const normPackageUnit = input.package_size_unit
        ? normalizeUnit(input.package_size_unit)
        : null;

      await enqueueMutation(db, {
        entity: 'shopping_list_items',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          name: input.name,
          quantity: input.quantity,
          unit: normUnit,
          package_size: input.package_size ?? null,
          package_size_unit: normPackageUnit,
          category_id: input.category_id,
          category_source: input.category_source,
          category_classifier_version: input.category_classifier_version,
          store_id: input.store_id,
          price_estimate: input.price_estimate,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            `update shopping_list_items
             set name = ?, quantity = ?, unit = ?, package_size = ?, package_size_unit = ?,
                 category_id = ?, category_source = ?, category_classifier_version = ?,
                 store_id = ?, price_estimate = ?, updated_at = ?, _dirty = 1
             where id = ?`,
            [
              input.name,
              input.quantity,
              normUnit,
              input.package_size ?? null,
              normPackageUnit,
              input.category_id,
              input.category_source,
              input.category_classifier_version,
              input.store_id,
              input.price_estimate,
              nowMs,
              input.id,
            ],
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
