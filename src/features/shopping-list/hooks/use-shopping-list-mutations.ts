import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import {
  type AddShoppingItemInput as AddItemInput,
  addOrMergeShoppingItem,
  buildAddOrMergeShoppingItemMutation,
} from '@/lib/db/shopping-list-merge';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import { normalizeUnit } from '@/lib/units';
import type { CategorySource } from '../classification/types';
import type { CategoryPreferenceMutation } from '../preferences/api';
import type { CategoryFeedbackDraft, CategoryFeedbackInput } from '../preferences/feedback';
import { saveShoppingItemAtomically } from '../preferences/save-shopping-item';

export type UpdateItemInput = {
  id: string;
  household_id: string;
  name: string;
  quantity: number;
  unit: string;
  package_size?: number | null;
  package_size_unit?: string | null;
  category_id: string | null;
  category_source: CategorySource | null;
  category_classifier_version: string | null;
  store_id: string | null;
  price_estimate: number | null;
  /** Optionaler Preference-Schritt fuer den atomaren Formular-Save. */
  preference?: CategoryPreferenceMutation;
  /** Optionales, bereits Alpha-geprueftes Feedback-Event. */
  feedback?: CategoryFeedbackInput;
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
export type AddShoppingItemMutationInput = AddItemInput & {
  /** Optionaler Preference-Schritt fuer den atomaren Formular-Save. */
  preference?: CategoryPreferenceMutation;
  /** Optionales, bereits Alpha-geprueftes Feedback-Event. */
  feedback?: CategoryFeedbackDraft;
};

export function useAddShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddShoppingItemMutationInput) => {
      const db = await getDatabase();
      const { preference, feedback, ...itemInput } = input;
      if (!preference && !feedback) {
        return addOrMergeShoppingItem(db, Crypto.randomUUID(), itemInput);
      }

      const itemMutation = await buildAddOrMergeShoppingItemMutation(
        db,
        Crypto.randomUUID(),
        itemInput,
      );
      await saveShoppingItemAtomically({
        db,
        itemMutation,
        preference,
        feedback: feedback ? { ...feedback, shoppingListItemId: itemMutation.entityId } : undefined,
      });
      return itemMutation.entityId;
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

      await saveShoppingItemAtomically({
        db,
        preference: input.preference,
        feedback: input.feedback,
        nowMs,
        itemMutation: {
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
          now: nowMs,
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'shopping_list_items',
              'update',
              {
                id: input.id,
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
              },
              nowMs,
            ),
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
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'shopping_list_items',
            'update',
            { id: input.id, checked_at: input.checked_at, checked_by: input.checked_by },
            nowMs,
          ),
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
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'shopping_list_items', 'delete', { id: input.id }, nowMs),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
