import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation, enqueueMutations } from '@/lib/db/outbox';
import { debugLogEvent } from '@/lib/debug-log';
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

debugLogEvent('shopping-list.mutations.module-loaded', { variant: 'android' });

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

export type MoveShoppingItemsInput = {
  household_id: string;
  item_ids: readonly string[];
  store_id: string | null;
};

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
      debugLogEvent('shopping-list.add-item.mutation.started', {
        variant: 'android',
        householdId: input.household_id,
        productId: input.product_id ?? null,
        name: input.name,
        quantity: input.quantity,
        unit: input.unit,
      });

      const db = await getDatabase();
      const { preference, feedback, ...itemInput } = input;
      try {
        if (!preference && !feedback) {
          const entityId = await addOrMergeShoppingItem(db, Crypto.randomUUID(), itemInput);
          debugLogEvent('shopping-list.add-item.mutation.completed', {
            variant: 'android',
            householdId: input.household_id,
            entityId,
            path: 'shopping-list-merge',
          });
          return entityId;
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
          feedback: feedback
            ? { ...feedback, shoppingListItemId: itemMutation.entityId }
            : undefined,
        });
        debugLogEvent('shopping-list.add-item.mutation.completed', {
          variant: 'android',
          householdId: input.household_id,
          entityId: itemMutation.entityId,
          path: 'atomic-save',
        });
        return itemMutation.entityId;
      } catch (error) {
        debugLogEvent('shopping-list.add-item.mutation.failed', {
          variant: 'android',
          householdId: input.household_id,
          productId: input.product_id ?? null,
          name: input.name,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      trackAnalyticsEvent('shopping_item.create.completed');
      queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

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
      trackAnalyticsEvent('shopping_item.update.completed');
      queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

/** Verschiebt mehrere Einkaufsartikel atomar in eine andere Markt-Liste. */
export function useMoveShoppingItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MoveShoppingItemsInput) => {
      if (input.item_ids.length === 0) return;

      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      await enqueueMutations(
        db,
        input.item_ids.map((id) => ({
          entity: 'shopping_list_items' as const,
          entityId: id,
          op: 'update' as const,
          payload: {
            id,
            household_id: input.household_id,
            store_id: input.store_id,
            updated_at: now,
          },
          now: nowMs,
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'shopping_list_items',
              'update',
              { id, store_id: input.store_id },
              nowMs,
            ),
        })),
      );
    },
    onSuccess: (_, variables) => {
      trackAnalyticsEvent('shopping_item.update.completed');
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
      trackAnalyticsEvent(
        variables.checked_at ? 'shopping_item.check.completed' : 'shopping_item.uncheck.completed',
      );
      queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.household_id] });
    },
  });
}

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
      trackAnalyticsEvent('shopping_item.delete.completed');
      queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
