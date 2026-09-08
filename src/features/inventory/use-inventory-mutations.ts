import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { useSession } from '@/features/auth/session-provider';
import { trackAnalyticsEvent } from '@/lib/analytics';
import type { Database } from '@/lib/database.types';
import { getDatabase } from '@/lib/db/client';
import {
  type EnqueueMutationInput,
  enqueueMutation,
  enqueueMutations,
  enqueueMutationsInExclusiveTransaction,
} from '@/lib/db/outbox';
import type { FridgeItemConflict } from '@/lib/db/outbox-conflicts';
import { fromInventoryQuantityUnits, toInventoryQuantityUnits } from '@/lib/inventory-quantity';
import { getSupabase } from '@/lib/supabase';
import { createInventoryMoveMutation } from '@/lib/sync/inventory-move';
import { createInventoryMergeUndoMutation } from '@/lib/sync/inventory-open-merge';
import { createInventorySplitMutation } from '@/lib/sync/inventory-open-split';
import { createInventoryQuantityMutation } from '@/lib/sync/inventory-quantity';
import { createInventoryQuantityCorrectionMutation } from '@/lib/sync/inventory-quantity-correction';
import { createInventoryQuantityReversalMutation } from '@/lib/sync/inventory-quantity-reversal';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import {
  discardInventoryConflict,
  reconfirmInventoryQuantityCorrection,
} from '@/lib/sync/resolve-inventory-conflict';
import { normalizeUnit } from '@/lib/units';
import type { WasteReason } from './components/waste-inventory-item-sheet';
import {
  getSplitOriginItemId,
  inventoryUndoMode,
  inverseTransactionType,
  type LifecycleItem,
  planOpenInventoryItem,
  planUndoOpenTransaction,
  undoTransactionNotes,
} from './inventory-lifecycle';
import type { LocalInventoryItem } from './use-inventory-items';
import {
  isInventoryMoveTransaction,
  type LocalInventoryTransaction,
} from './use-inventory-transactions';

export type FridgeItem = {
  id: string;
  household_id: string;
  location_id: string | null;
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  package_size: number | null;
  package_size_unit: string | null;
  expiry_date: string | null;
  opened_at?: string | null;
  vacuum_sealed?: boolean;
  expiry_user_set?: boolean;
};

type TransactionPayload = Omit<
  Database['public']['Tables']['transactions']['Row'],
  'operation_id' | 'reversal_of' | 'sync_sequence' | 'origin_item_id' | 'origin_quantity'
> & {
  operation_id: string | null;
  reversal_of: string | null;
  origin_item_id?: string | null;
  origin_quantity?: number | null;
};
type TransactionDraft = Omit<TransactionPayload, 'operation_id' | 'reversal_of'> & {
  operation_id?: string | null;
  reversal_of?: string | null;
};

function transactionMutation(payload: TransactionDraft, nowMs: number): EnqueueMutationInput {
  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    throw new Error('Ledger-Buchungen benötigen eine positive Menge.');
  }
  toInventoryQuantityUnits(payload.quantity);

  const normalizedPayload: TransactionPayload = {
    operation_id: null,
    reversal_of: null,
    ...payload,
  };
  return {
    entity: 'transactions',
    entityId: normalizedPayload.id,
    op: 'insert',
    payload: normalizedPayload,
    applyLocally: (txn) =>
      applyLocalMirrorWrite(txn, 'transactions', 'insert', normalizedPayload, nowMs),
  };
}

function assertValidInventoryQuantity(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('Bestandsmengen müssen endlich und nicht negativ sein.');
  }
  toInventoryQuantityUnits(quantity);
}

function groupedMoveMutation(input: {
  itemId: string;
  householdId: string;
  productId: string | null;
  quantity: number;
  expectedLocationId: string | null;
  newLocationId: string | null;
  actor: string | null;
  createdAt: string;
  nowMs: number;
  reversalOf?: string | null;
  notes?: string | null;
}): EnqueueMutationInput {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error('Ledger-Buchungen benötigen eine positive Menge.');
  }
  toInventoryQuantityUnits(input.quantity);

  const operationId = Crypto.randomUUID();
  const outTransactionId = Crypto.randomUUID();
  const inTransactionId = Crypto.randomUUID();
  const commonTransaction = {
    household_id: input.householdId,
    product_id: input.productId,
    actor: input.actor,
    quantity: input.quantity,
    reason: null,
    previous_expiry_date: null,
    notes: input.notes ?? null,
    undone: false,
    created_at: input.createdAt,
    fridge_item_id: input.itemId,
    operation_id: operationId,
    reversal_of: input.reversalOf ?? null,
  } as const;

  return createInventoryMoveMutation({
    payload: {
      operation_id: operationId,
      item_id: input.itemId,
      household_id: input.householdId,
      expected_location_id: input.expectedLocationId,
      new_location_id: input.newLocationId,
      expected_quantity: input.quantity,
      out_transaction_id: outTransactionId,
      in_transaction_id: inTransactionId,
      created_at: input.createdAt,
      reversal_of: input.reversalOf ?? null,
      notes: input.notes ?? null,
    },
    outTransaction: {
      id: outTransactionId,
      ...commonTransaction,
      type: 'out',
      location_id: input.expectedLocationId,
    },
    inTransaction: {
      id: inTransactionId,
      ...commonTransaction,
      type: 'in',
      location_id: input.newLocationId,
    },
    nowMs: input.nowMs,
  });
}

function transactionPayloadFromPlan(
  transaction: ReturnType<typeof planOpenInventoryItem>['transaction'],
  id: string,
  actor: string | null,
): TransactionDraft {
  return {
    id,
    household_id: transaction.householdId,
    fridge_item_id: transaction.fridgeItemId,
    product_id: transaction.productId,
    actor,
    type: transaction.type,
    quantity: transaction.quantity,
    location_id: transaction.locationId,
    reason: transaction.reason ?? null,
    previous_expiry_date: transaction.previousExpiryDate,
    origin_item_id: transaction.originItemId ?? null,
    origin_quantity: transaction.originQuantity ?? null,
    notes: transaction.notes ?? null,
    undone: false,
    created_at: transaction.createdAt,
  };
}

function lifecycleItemFromLocal(item: LocalInventoryItem) {
  return {
    id: item.id,
    householdId: item.household_id,
    locationId: item.location_id,
    productId: item.product_id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    expiryDate: item.expiry_date,
    openedAt: item.opened_at ?? null,
    vacuumSealed: item.vacuum_sealed ?? false,
    expiryUserSet: item.expiry_user_set ?? false,
    packageSize: item.package_size,
    packageSizeUnit: item.package_size_unit,
    addedBy: item.added_by,
    locationKind: item.location_kind ?? null,
    updatedAt: item.updated_at ?? null,
  } as const;
}

function lifecycleItemPayload(item: LifecycleItem) {
  return {
    id: item.id,
    household_id: item.householdId,
    location_id: item.locationId,
    product_id: item.productId,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    package_size: item.packageSize,
    package_size_unit: item.packageSizeUnit,
    expiry_date: item.expiryDate,
    added_by: item.addedBy,
    opened_at: item.openedAt,
    vacuum_sealed: item.vacuumSealed,
    expiry_user_set: item.expiryUserSet,
  };
}

function lifecyclePatchPayload(patch: Partial<LifecycleItem>) {
  return {
    ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
    ...(patch.expiryDate !== undefined ? { expiry_date: patch.expiryDate } : {}),
    ...(patch.openedAt !== undefined ? { opened_at: patch.openedAt } : {}),
    ...(patch.vacuumSealed !== undefined ? { vacuum_sealed: patch.vacuumSealed } : {}),
    ...(patch.expiryUserSet !== undefined ? { expiry_user_set: patch.expiryUserSet } : {}),
  };
}

function useInventoryActor(): string | null {
  const { session } = useSession();
  return session?.user.id ?? null;
}

export function useAddFridgeItemMutation() {
  const queryClient = useQueryClient();
  const actor = useInventoryActor();

  return useMutation({
    mutationFn: async (item: Omit<FridgeItem, 'id'>) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const normUnit = normalizeUnit(item.unit);
      const normPackageUnit = item.package_size_unit ? normalizeUnit(item.package_size_unit) : null;
      const row = {
        id,
        ...item,
        unit: normUnit,
        package_size_unit: normPackageUnit,
        opened_at: item.opened_at ?? null,
        vacuum_sealed: item.vacuum_sealed ?? false,
        expiry_user_set: item.expiry_user_set ?? item.expiry_date !== null,
      };
      const transactionId = Crypto.randomUUID();
      const transaction: TransactionDraft = {
        id: transactionId,
        household_id: item.household_id,
        fridge_item_id: id,
        product_id: item.product_id,
        actor,
        type: 'in',
        quantity: item.quantity,
        location_id: item.location_id,
        reason: null,
        previous_expiry_date: null,
        notes: null,
        undone: false,
        created_at: now,
      };

      await enqueueMutations(db, [
        {
          entity: 'fridge_items',
          entityId: id,
          op: 'insert',
          payload: { ...row, created_at: now, updated_at: now },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'fridge_items',
              'insert',
              { ...row, created_at: now },
              nowMs,
            ),
        },
        transactionMutation(transaction, nowMs),
      ]);

      return id;
    },
    onSuccess: (_, variables) => {
      trackAnalyticsEvent('inventory_item.create.completed');
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useRestoreFridgeItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, household_id }: { id: string; household_id: string }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      await enqueueMutation(db, {
        entity: 'fridge_items',
        entityId: id,
        op: 'restore',
        payload: { id, household_id, deleted_at: null, updated_at: now },
        applyLocally: (txn) => applyLocalMirrorWrite(txn, 'fridge_items', 'restore', { id }, nowMs),
      });

      return id;
    },
    onSuccess: (_, variables) => {
      trackAnalyticsEvent('inventory_item.restore.completed');
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateInventoryItemQuantityMutation() {
  const queryClient = useQueryClient();
  const actor = useInventoryActor();

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
      if (!Number.isFinite(delta)) {
        throw new Error('Mengenänderungen benötigen eine endliche Zahl.');
      }

      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      let result: { id: string; newQty: number } | undefined;

      await enqueueMutationsInExclusiveTransaction(db, async (txn) => {
        const existing = await txn.getFirstAsync<{
          quantity: number;
          product_id: string | null;
          location_id: string | null;
        }>('select quantity, product_id, location_id from fridge_items where id = ?', [id]);
        if (!existing) return [];

        const currentUnits = toInventoryQuantityUnits(existing.quantity);
        const requestedDeltaUnits = toInventoryQuantityUnits(delta);
        const newQuantityUnits = Math.max(0, currentUnits + requestedDeltaUnits);
        const effectiveDeltaUnits = newQuantityUnits - currentUnits;
        const newQty = fromInventoryQuantityUnits(newQuantityUnits);
        result = { id, newQty };
        if (effectiveDeltaUnits === 0) return [];
        const effectiveDelta = fromInventoryQuantityUnits(effectiveDeltaUnits);

        const transactionId = Crypto.randomUUID();
        const operationId = Crypto.randomUUID();
        const transaction: TransactionDraft = {
          id: transactionId,
          operation_id: operationId,
          household_id,
          fridge_item_id: id,
          product_id: existing.product_id,
          actor,
          type: effectiveDelta < 0 ? 'out' : 'in',
          quantity: Math.abs(effectiveDelta),
          location_id: existing.location_id,
          reason: null,
          previous_expiry_date: null,
          notes: null,
          undone: false,
          created_at: now,
        };

        return [
          createInventoryQuantityMutation({
            payload: {
              operation_id: operationId,
              transaction_id: transactionId,
              item_id: id,
              household_id,
              delta: effectiveDelta,
              created_at: now,
            },
            transaction,
            resultQuantity: newQty,
            nowMs,
          }),
        ];
      });

      return result;
    },
    onSuccess: (result, variables) => {
      if (result) {
        if (variables.delta < 0) {
          trackAnalyticsEvent('inventory_item.consume.completed', {
            depleted: result.newQty === 0,
          });
          if (result.newQty === 0) {
            trackAnalyticsEvent('inventory_item.delete.completed');
          }
        } else {
          trackAnalyticsEvent('inventory_item.update.completed');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

/** Compare-and-set-Wunsch für eine bewusste Mengenkorrektur im Bearbeiten-Dialog. */
export type FridgeItemQuantityCorrection = {
  expectedQuantity: number;
  newQuantity: number;
};

export type FridgeItemMetadataPatch = Partial<
  Pick<
    FridgeItem,
    | 'product_id'
    | 'name'
    | 'unit'
    | 'package_size'
    | 'package_size_unit'
    | 'location_id'
    | 'expiry_date'
    | 'opened_at'
    | 'vacuum_sealed'
    | 'expiry_user_set'
  >
>;

/**
 * Eingabe für die manuelle Bearbeitung. `quantity` ist bewusst kein Feld hier:
 * eine reine Metadatenänderung darf nie implizit eine Menge mitschicken. Eine
 * gewollte Mengenkorrektur wird explizit über `quantityCorrection` übergeben,
 * mit der beim Öffnen des Dialogs geladenen Menge als `expectedQuantity`.
 */
export type UpdateFridgeItemInput = Pick<FridgeItem, 'id' | 'household_id'> & {
  patch: FridgeItemMetadataPatch;
  quantityCorrection?: FridgeItemQuantityCorrection;
};

export function useUpdateFridgeItemMutation() {
  const queryClient = useQueryClient();
  const actor = useInventoryActor();

  return useMutation({
    mutationFn: async (item: UpdateFridgeItemInput) => {
      if (item.quantityCorrection) {
        assertValidInventoryQuantity(item.quantityCorrection.expectedQuantity);
        assertValidInventoryQuantity(item.quantityCorrection.newQuantity);
      }
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      let resultPayload: Record<string, unknown> = { id: item.id, household_id: item.household_id };

      await enqueueMutationsInExclusiveTransaction(db, async (txn) => {
        const existing = await txn.getFirstAsync<
          Partial<FridgeItem> & {
            quantity: number;
            location_id: string | null;
            vacuum_sealed?: boolean | number;
            expiry_user_set?: boolean | number;
          }
        >('select * from fridge_items where id = ?', [item.id]);
        if (!existing) {
          throw new Error('Der Bestand ist lokal nicht vorhanden.');
        }

        const metadataPatch: Record<string, unknown> = { id: item.id };
        if (
          item.patch.product_id !== undefined &&
          item.patch.product_id !== existing.product_id
        ) {
          metadataPatch.product_id = item.patch.product_id;
        }
        if (item.patch.name !== undefined && item.patch.name !== existing.name) {
          metadataPatch.name = item.patch.name;
        }
        if (
          item.patch.unit !== undefined &&
          normalizeUnit(item.patch.unit) !==
            (existing.unit === undefined ? undefined : normalizeUnit(existing.unit))
        ) {
          const unit = normalizeUnit(item.patch.unit);
          metadataPatch.unit = unit;
        }
        if (
          item.patch.package_size !== undefined &&
          item.patch.package_size !== existing.package_size
        ) {
          metadataPatch.package_size = item.patch.package_size;
        }
        if (
          item.patch.package_size_unit !== undefined &&
          (item.patch.package_size_unit
            ? normalizeUnit(item.patch.package_size_unit)
            : null) !==
            (existing.package_size_unit ? normalizeUnit(existing.package_size_unit) : null)
        ) {
          metadataPatch.package_size_unit = item.patch.package_size_unit
            ? normalizeUnit(item.patch.package_size_unit)
            : null;
        }
        if (
          item.patch.expiry_date !== undefined &&
          item.patch.expiry_date !== existing.expiry_date
        ) {
          metadataPatch.expiry_date = item.patch.expiry_date;
        }
        if (
          item.patch.opened_at !== undefined &&
          item.patch.opened_at !== existing.opened_at
        ) {
          metadataPatch.opened_at = item.patch.opened_at;
        }
        if (
          item.patch.vacuum_sealed !== undefined &&
          item.patch.vacuum_sealed !== Boolean(existing.vacuum_sealed)
        ) {
          metadataPatch.vacuum_sealed = item.patch.vacuum_sealed;
        }
        if (
          item.patch.expiry_user_set !== undefined &&
          item.patch.expiry_user_set !== Boolean(existing.expiry_user_set)
        ) {
          metadataPatch.expiry_user_set = item.patch.expiry_user_set;
        }

        const existingQuantityUnits = toInventoryQuantityUnits(existing.quantity);
        const mutations: EnqueueMutationInput[] = [];

        if (Object.keys(metadataPatch).length > 1) {
          const payload = {
            ...metadataPatch,
            household_id: item.household_id,
          };
          resultPayload = payload;
          mutations.push({
            entity: 'fridge_items',
            entityId: item.id,
            op: 'update',
            payload,
            applyLocally: (innerTxn) =>
              applyLocalMirrorWrite(innerTxn, 'fridge_items', 'update', metadataPatch, nowMs),
          });
        }

        // Effektive Menge nach dieser Bearbeitung: nur eine explizite
        // Korrektur ändert sie, ein reiner Metadaten-Patch lässt sie unberührt.
        let effectiveQuantityUnits = existingQuantityUnits;

        if (item.quantityCorrection) {
          const expectedUnits = toInventoryQuantityUnits(item.quantityCorrection.expectedQuantity);
          const newUnits = toInventoryQuantityUnits(item.quantityCorrection.newQuantity);
          if (newUnits !== expectedUnits) {
            const operationId = Crypto.randomUUID();
            const transactionId = Crypto.randomUUID();
            const correctedQuantity = fromInventoryQuantityUnits(newUnits);
            const correctionQuantity = fromInventoryQuantityUnits(
              Math.abs(newUnits - expectedUnits),
            );
            const correctionType = newUnits > expectedUnits ? 'in' : 'out';
            mutations.push(
              createInventoryQuantityCorrectionMutation({
                payload: {
                  operation_id: operationId,
                  transaction_id: transactionId,
                  item_id: item.id,
                  household_id: item.household_id,
                  // Erwartungsmenge stammt aus dem beim Dialog-Öffnen geladenen
                  // Zustand, nicht aus dem lokalen Spiegel zum Zeitpunkt des
                  // Speicherns — sonst maskiert ein zwischenzeitlicher Verbrauch
                  // den Konflikt statt ihn dem Server zur Prüfung zu melden.
                  expected_quantity: item.quantityCorrection.expectedQuantity,
                  new_quantity: correctedQuantity,
                  created_at: now,
                },
                transaction: {
                  id: transactionId,
                  operation_id: operationId,
                  household_id: item.household_id,
                  fridge_item_id: item.id,
                  product_id:
                    item.patch.product_id !== undefined
                      ? item.patch.product_id
                      : (existing.product_id ?? null),
                  actor,
                  type: correctionType,
                  quantity: correctionQuantity,
                  location_id: existing.location_id,
                  reason: null,
                  previous_expiry_date: null,
                  notes: '[Manual correction]',
                  undone: false,
                  created_at: now,
                },
                nowMs,
              }),
            );
            effectiveQuantityUnits = newUnits;
          }
        }

        const locationChanged =
          effectiveQuantityUnits > 0 &&
          item.patch.location_id !== undefined &&
          item.patch.location_id !== existing.location_id;
        if (locationChanged) {
          mutations.push(
            groupedMoveMutation({
              itemId: item.id,
              householdId: item.household_id,
              productId:
                item.patch.product_id !== undefined
                  ? item.patch.product_id
                  : (existing.product_id ?? null),
              quantity: fromInventoryQuantityUnits(effectiveQuantityUnits),
              expectedLocationId: existing.location_id,
              newLocationId: item.patch.location_id ?? null,
              actor,
              createdAt: now,
              nowMs,
            }),
          );
        }

        return mutations;
      });
      return resultPayload;
    },
    onSuccess: (_, variables) => {
      trackAnalyticsEvent('inventory_item.update.completed');
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['fridge_item', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useOpenInventoryItemMutation() {
  const queryClient = useQueryClient();
  const actor = useInventoryActor();

  return useMutation({
    mutationFn: async ({ item, quantity }: { item: LocalInventoryItem; quantity: number }) => {
      const db = await getDatabase();
      const now = new Date();
      const nowIso = now.toISOString();
      const nowMs = now.getTime();
      const openedItemId = Crypto.randomUUID();
      const transactionId = Crypto.randomUUID();
      let result: { itemId: string; openedItemId: string } | undefined;

      // Lesen, Planen und Enqueue laufen in derselben exklusiven Transaktion:
      // der `item`-Parameter ist nur der Anker (id/household_id), die Menge
      // fuer die Planung kommt aus dem frisch gelesenen lokalen Stand, nicht
      // aus einem moeglicherweise veralteten UI-Snapshot.
      await enqueueMutationsInExclusiveTransaction(db, async (txn) => {
        const current = await txn.getFirstAsync<LocalInventoryItem>(
          `select fi.id, fi.household_id, fi.location_id, fi.product_id, fi.name,
                  fi.quantity, fi.unit, fi.package_size, fi.package_size_unit,
                  fi.expiry_date, fi.opened_at, fi.vacuum_sealed, fi.expiry_user_set,
                  fi.added_by, fi.created_at, fi.updated_at,
                  sl.kind as location_kind, sl.name as location_name
             from fridge_items fi
             left join storage_locations sl on fi.location_id = sl.id
            where fi.id = ? and fi.household_id = ? and fi.deleted_at is null`,
          [item.id, item.household_id],
        );
        if (!current) throw new Error('Der Bestand ist lokal nicht vorhanden.');

        const plan = planOpenInventoryItem(
          lifecycleItemFromLocal(current),
          quantity,
          now,
          openedItemId,
        );
        const transaction = transactionPayloadFromPlan(plan.transaction, transactionId, actor);
        result = { itemId: current.id, openedItemId: plan.openedItem?.id ?? current.id };

        if (!plan.openedItem) {
          // In-place-Öffnung: ein einzelnes Los, keine Mengenänderung.
          const originalPatch = lifecyclePatchPayload(plan.originalPatch);
          const originalPayload = {
            id: current.id,
            household_id: current.household_id,
            ...originalPatch,
          };
          return [
            {
              entity: 'fridge_items',
              entityId: current.id,
              op: 'update',
              payload: { ...originalPayload, updated_at: nowIso },
              applyLocally: (innerTxn) =>
                applyLocalMirrorWrite(
                  innerTxn,
                  'fridge_items',
                  'update',
                  { id: current.id, ...originalPatch },
                  nowMs,
                ),
            },
            transactionMutation(transaction, nowMs),
          ];
        }

        // Split: Rest-Los, neues geöffnetes Los und Ledger laufen als eine
        // atomare Server-Operation mit Compare-and-set gegen die frisch
        // gelesene Ausgangsmenge — kein absolutes Update aus einem
        // zwischenzeitlich veralteten Snapshot (fam-n46.1).
        return [
          createInventorySplitMutation({
            payload: {
              transaction_id: transactionId,
              source_item_id: current.id,
              opened_item_id: openedItemId,
              household_id: current.household_id,
              expected_source_quantity: current.quantity,
              open_quantity: quantity,
              opened_at: nowIso,
              new_expiry_date: plan.openedItem.expiryDate,
              expiry_user_set: plan.openedItem.expiryUserSet,
              created_at: nowIso,
            },
            openedItem: lifecycleItemPayload(plan.openedItem),
            transaction,
            nowMs,
          }),
        ];
      });

      if (!result) throw new Error('Der Bestand ist lokal nicht vorhanden.');
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.item.household_id] });
      queryClient.invalidateQueries({
        queryKey: ['fridge_items_grouped', variables.item.household_id],
      });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.item.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useWasteInventoryItemMutation() {
  const queryClient = useQueryClient();
  const actor = useInventoryActor();

  return useMutation({
    mutationFn: async ({ item, reason }: { item: LocalInventoryItem; reason: WasteReason }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const transaction = transactionMutation(
        {
          id: Crypto.randomUUID(),
          household_id: item.household_id,
          fridge_item_id: item.id,
          product_id: item.product_id,
          actor,
          type: 'waste',
          quantity: item.quantity,
          location_id: item.location_id,
          reason,
          previous_expiry_date: null,
          notes: null,
          undone: false,
          created_at: now,
        },
        nowMs,
      );
      await enqueueMutations(db, [
        {
          entity: 'fridge_items',
          entityId: item.id,
          op: 'delete',
          payload: {
            id: item.id,
            household_id: item.household_id,
            deleted_at: now,
            updated_at: now,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(txn, 'fridge_items', 'delete', { id: item.id }, nowMs),
        },
        transaction,
      ]);
      return item.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.item.household_id] });
      queryClient.invalidateQueries({
        queryKey: ['fridge_items_grouped', variables.item.household_id],
      });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.item.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useMoveInventoryItemMutation() {
  const queryClient = useQueryClient();
  const actor = useInventoryActor();

  return useMutation({
    mutationFn: async ({
      item,
      locationId,
    }: {
      item: LocalInventoryItem;
      locationId: string | null;
    }) => {
      if (item.location_id === locationId) return item.id;
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      await enqueueMutations(db, [
        groupedMoveMutation({
          itemId: item.id,
          householdId: item.household_id,
          productId: item.product_id,
          quantity: item.quantity,
          expectedLocationId: item.location_id,
          newLocationId: locationId,
          actor,
          createdAt: now,
          nowMs,
        }),
      ]);
      return item.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.item.household_id] });
      queryClient.invalidateQueries({
        queryKey: ['fridge_items_grouped', variables.item.household_id],
      });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.item.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUndoOpenTransactionMutation() {
  const queryClient = useQueryClient();
  const actor = useInventoryActor();

  return useMutation({
    mutationFn: async ({ transaction }: { transaction: LocalInventoryTransaction }) => {
      if (transaction.type !== 'open')
        throw new Error('Nur Öffnungen können hier rückgängig gemacht werden.');
      if (transaction.reversal_of || transaction.undone || transaction.notes?.includes('[Undone]'))
        throw new Error('Diese Öffnung wurde bereits rückgängig gemacht.');
      const db = await getDatabase();
      const now = new Date();
      const nowIso = now.toISOString();
      const nowMs = now.getTime();
      let resultHouseholdId: string | undefined;

      // Lesen, Planen und Enqueue laufen in derselben exklusiven Transaktion,
      // damit kein zweiter lokaler Aufruf zwischen Plan und Enqueue denselben
      // Split oder dieselbe Öffnung anfasst (fam-n46.1).
      await enqueueMutationsInExclusiveTransaction(db, async (txn) => {
        const existingUndo = await txn.getFirstAsync<{ id: string }>(
          `select id
             from transactions
            where household_id = ?
              and fridge_item_id = ?
              and (
                reversal_of = ?
                or (
                  type = 'open'
                  and quantity = ?
                  and previous_expiry_date is ?
                  and notes = '[Undone] Öffnung rückgängig gemacht'
                  and created_at > ?
                )
              )
            limit 1`,
          [
            transaction.household_id,
            transaction.fridge_item_id,
            transaction.id,
            transaction.quantity,
            transaction.previous_expiry_date,
            transaction.created_at,
          ],
        );
        if (existingUndo) throw new Error('Diese Öffnung wurde bereits rückgängig gemacht.');

        const openedRow = await txn.getFirstAsync<LocalInventoryItem>(
          `select fi.id, fi.household_id, fi.location_id, fi.product_id, fi.name,
                  fi.quantity, fi.unit, fi.package_size, fi.package_size_unit,
                  fi.expiry_date, fi.opened_at, fi.vacuum_sealed, fi.expiry_user_set,
                  fi.added_by, fi.created_at, fi.updated_at,
                  sl.kind as location_kind, sl.name as location_name
             from fridge_items fi
             left join storage_locations sl on fi.location_id = sl.id
            where fi.id = ? and fi.deleted_at is null`,
          [transaction.fridge_item_id],
        );
        if (!openedRow) throw new Error('Der geöffnete Bestand ist nicht mehr vorhanden.');

        const splitOriginItemId = getSplitOriginItemId({
          originItemId: transaction.origin_item_id,
          notes: transaction.notes,
        });
        const sealedRow = splitOriginItemId
          ? await txn.getFirstAsync<LocalInventoryItem>(
              `select fi.id, fi.household_id, fi.location_id, fi.product_id, fi.name,
                      fi.quantity, fi.unit, fi.package_size, fi.package_size_unit,
                      fi.expiry_date, fi.opened_at, fi.vacuum_sealed, fi.expiry_user_set,
                      fi.added_by, fi.created_at, fi.updated_at,
                      sl.kind as location_kind, sl.name as location_name
                 from fridge_items fi
                 left join storage_locations sl on fi.location_id = sl.id
                where fi.id = ? and fi.household_id = ? and fi.opened_at is null
                  and fi.deleted_at is null`,
              [splitOriginItemId, transaction.household_id],
            )
          : null;
        const lifecycleTransaction = {
          id: transaction.id,
          actor: transaction.actor,
          type: 'open' as const,
          quantity: transaction.quantity,
          reason: transaction.reason,
          notes: transaction.notes,
          undone: transaction.undone,
          householdId: transaction.household_id,
          fridgeItemId: transaction.fridge_item_id,
          originItemId: splitOriginItemId,
          originQuantity: transaction.origin_quantity,
          productId: transaction.product_id,
          locationId: transaction.location_id,
          previousExpiryDate: transaction.previous_expiry_date,
          createdAt: transaction.created_at,
        };
        const undoMode = inventoryUndoMode(transaction.created_at, now);
        const plan =
          undoMode === 'undo'
            ? planUndoOpenTransaction(
                lifecycleTransaction,
                lifecycleItemFromLocal(openedRow),
                sealedRow ? lifecycleItemFromLocal(sealedRow) : null,
                now,
              )
            : null;

        resultHouseholdId = transaction.household_id;
        const notes = undoTransactionNotes(undoMode, 'open');
        const genericReversalLedger = () =>
          transactionMutation(
            {
              id: Crypto.randomUUID(),
              household_id: transaction.household_id,
              fridge_item_id: transaction.fridge_item_id,
              product_id: transaction.product_id,
              actor,
              type: 'open',
              quantity: transaction.quantity,
              location_id: transaction.location_id,
              reason: null,
              previous_expiry_date: openedRow.expiry_date,
              notes,
              undone: false,
              reversal_of: transaction.id,
              created_at: nowIso,
            },
            nowMs,
          );

        if (undoMode === 'manual-correction') {
          if (openedRow.opened_at === null) {
            throw new Error('Der geöffnete Bestand wurde bereits verändert.');
          }
          const patch = {
            opened_at: null,
            expiry_date: transaction.previous_expiry_date,
            expiry_user_set: transaction.previous_expiry_date !== null,
          };
          return [
            {
              entity: 'fridge_items',
              entityId: openedRow.id,
              op: 'update',
              payload: {
                id: openedRow.id,
                household_id: openedRow.household_id,
                ...patch,
                updated_at: nowIso,
              },
              applyLocally: (innerTxn) =>
                applyLocalMirrorWrite(
                  innerTxn,
                  'fridge_items',
                  'update',
                  { id: openedRow.id, ...patch },
                  nowMs,
                ),
            },
            genericReversalLedger(),
          ];
        }
        if (plan?.mode === 'restore-in-place' && plan.openedPatch) {
          const patch = lifecyclePatchPayload(plan.openedPatch);
          return [
            {
              entity: 'fridge_items',
              entityId: openedRow.id,
              op: 'update',
              payload: {
                id: openedRow.id,
                household_id: openedRow.household_id,
                ...patch,
                updated_at: nowIso,
              },
              applyLocally: (innerTxn) =>
                applyLocalMirrorWrite(
                  innerTxn,
                  'fridge_items',
                  'update',
                  { id: openedRow.id, ...patch },
                  nowMs,
                ),
            },
            genericReversalLedger(),
          ];
        }
        if (
          plan?.mode === 'merge-split' &&
          sealedRow &&
          plan.sealedPatch &&
          typeof plan.sealedPatch.quantity === 'number'
        ) {
          // Merge: versiegeltes Los, geöffnetes Los und Gegenbuchung laufen
          // als eine atomare Server-Operation mit Zeilensperren gegen die
          // referenzierte Split-Buchung — kein absolutes Update aus einem
          // zwischenzeitlich veralteten Snapshot (fam-n46.1).
          const reversalTransactionId = Crypto.randomUUID();
          return [
            createInventoryMergeUndoMutation({
              payload: {
                reversal_transaction_id: reversalTransactionId,
                reversal_of: transaction.id,
                household_id: transaction.household_id,
                created_at: nowIso,
                notes,
              },
              sealedItemId: sealedRow.id,
              sealedQuantityAfterMerge: plan.sealedPatch.quantity,
              openedItemId: openedRow.id,
              transaction: {
                id: reversalTransactionId,
                household_id: transaction.household_id,
                fridge_item_id: transaction.fridge_item_id,
                product_id: transaction.product_id,
                actor,
                type: 'open',
                quantity: transaction.quantity,
                location_id: transaction.location_id,
                previous_expiry_date: openedRow.expiry_date,
                notes,
                undone: false,
                reversal_of: transaction.id,
                created_at: nowIso,
              },
              nowMs,
            }),
          ];
        }
        // plan?.mode === 'fallback': Der Split-Ursprung wurde nach dem Öffnen
        // verändert. Der Undo bleibt als Provenienzbuchung erhalten, ändert
        // aber kein Lot.
        return [genericReversalLedger()];
      });

      if (resultHouseholdId === undefined) {
        throw new Error('Der geöffnete Bestand ist nicht mehr vorhanden.');
      }
      return resultHouseholdId;
    },
    onSuccess: (householdId) => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', householdId] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', householdId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

type UndoInventoryItem = LocalInventoryItem & { deleted_at: number | null };

type MoveLedgerLeg = {
  id: string;
  type: 'in' | 'out';
  quantity: number;
  location_id: string | null;
  fridge_item_id: string | null;
  reversal_of: string | null;
};

async function enqueueQuantityReversal(
  db: Awaited<ReturnType<typeof getDatabase>>,
  transaction: LocalInventoryTransaction,
  actor: string | null,
  mode: ReturnType<typeof inventoryUndoMode>,
): Promise<void> {
  if (!transaction.fridge_item_id) {
    throw new Error('Diese Buchung ist keinem Bestandslos zugeordnet.');
  }

  const inverseType = inverseTransactionType(transaction.type);
  if (inverseType === 'open') {
    throw new Error('Öffnungen werden über den Open-Undo-Pfad behandelt.');
  }

  const now = new Date().toISOString();
  const nowMs = Date.now();
  await enqueueMutationsInExclusiveTransaction(db, async (txn) => {
    const item = await txn.getFirstAsync<UndoInventoryItem>(
      `select fi.id, fi.household_id, fi.location_id, fi.product_id, fi.name,
              fi.quantity, fi.unit, fi.package_size, fi.package_size_unit,
              fi.expiry_date, fi.opened_at, fi.vacuum_sealed, fi.expiry_user_set,
              fi.added_by, fi.created_at, fi.updated_at, fi.deleted_at,
              sl.kind as location_kind, sl.name as location_name
         from fridge_items fi
         left join storage_locations sl on fi.location_id = sl.id
        where fi.id = ? and fi.household_id = ?`,
      [transaction.fridge_item_id, transaction.household_id],
    );
    if (!item) throw new Error('Der Bestand ist lokal nicht vorhanden.');

    const existingReversal = await txn.getFirstAsync<{ id: string }>(
      `select id from transactions where household_id = ? and reversal_of = ? limit 1`,
      [transaction.household_id, transaction.id],
    );
    if (existingReversal) throw new Error('Diese Buchung wurde bereits rückgängig gemacht.');

    const itemUnits = toInventoryQuantityUnits(item.quantity);
    const transactionUnits = toInventoryQuantityUnits(transaction.quantity);
    let resultUnits: number;
    const restore = item.deleted_at !== null;

    if (restore) {
      const isFullyConsumedQuantityOperation =
        transaction.operation_id !== undefined &&
        transaction.operation_id !== null &&
        transaction.type === 'out' &&
        itemUnits === 0;
      if (
        transaction.type === 'in' ||
        (!isFullyConsumedQuantityOperation && itemUnits !== transactionUnits)
      ) {
        throw new Error('Der Bestand wurde zwischenzeitlich verändert.');
      }
      resultUnits = isFullyConsumedQuantityOperation ? transactionUnits : itemUnits;
    } else {
      resultUnits =
        inverseType === 'out' ? itemUnits - transactionUnits : itemUnits + transactionUnits;
      if (resultUnits < 0) {
        throw new Error('Die Gegenbuchung würde eine negative Bestandsmenge erzeugen.');
      }
    }

    const reversalTransactionId = Crypto.randomUUID();
    const notes = undoTransactionNotes(mode, transaction.type);
    return [
      createInventoryQuantityReversalMutation({
        payload: {
          reversal_transaction_id: reversalTransactionId,
          reversal_of: transaction.id,
          item_id: item.id,
          household_id: transaction.household_id,
          created_at: now,
          notes,
        },
        transaction: {
          id: reversalTransactionId,
          reversal_of: transaction.id,
          household_id: transaction.household_id,
          fridge_item_id: item.id,
          product_id: transaction.product_id ?? item.product_id,
          actor,
          type: inverseType,
          quantity: fromInventoryQuantityUnits(transactionUnits),
          location_id: item.location_id ?? transaction.location_id,
          reason: null,
          previous_expiry_date: null,
          notes,
          undone: false,
          created_at: now,
        },
        resultQuantity: fromInventoryQuantityUnits(resultUnits),
        restore,
        nowMs,
      }),
    ];
  });
}

async function enqueueMoveReversal(
  db: Awaited<ReturnType<typeof getDatabase>>,
  transaction: LocalInventoryTransaction,
  actor: string | null,
  mode: ReturnType<typeof inventoryUndoMode>,
): Promise<void> {
  if (!transaction.operation_id) throw new Error('Die Move-Provenienz ist unvollständig.');

  const legs = await db.getAllAsync<MoveLedgerLeg>(
    `select id, type, quantity, location_id, fridge_item_id, reversal_of
       from transactions
      where household_id = ? and operation_id = ?
      order by type`,
    [transaction.household_id, transaction.operation_id],
  );
  const outLeg = legs.find((leg) => leg.type === 'out');
  const inLeg = legs.find((leg) => leg.type === 'in');
  if (legs.length !== 2 || !outLeg || !inLeg || !outLeg.fridge_item_id) {
    throw new Error('Die Move-Provenienz ist unvollständig.');
  }
  if (outLeg.fridge_item_id !== inLeg.fridge_item_id) {
    throw new Error('Die Move-Legs gehören nicht zum selben Bestand.');
  }

  const existingReversal = await db.getFirstAsync<{ id: string }>(
    `select id from transactions where household_id = ? and reversal_of = ? limit 1`,
    [transaction.household_id, transaction.operation_id],
  );
  if (existingReversal) throw new Error('Diese Verschiebung wurde bereits rückgängig gemacht.');

  const item = await db.getFirstAsync<{
    id: string;
    household_id: string;
    location_id: string | null;
    quantity: number;
    deleted_at: number | null;
    product_id: string | null;
  }>(
    `select id, household_id, location_id, quantity, deleted_at, product_id
       from fridge_items
      where id = ? and household_id = ?`,
    [outLeg.fridge_item_id, transaction.household_id],
  );
  if (!item || item.deleted_at !== null) {
    throw new Error('Der Bestand wurde zwischenzeitlich verändert.');
  }
  if (item.location_id !== inLeg.location_id || item.quantity !== inLeg.quantity) {
    throw new Error('Der Bestand wurde zwischenzeitlich verändert.');
  }

  const now = new Date().toISOString();
  await enqueueMutations(db, [
    groupedMoveMutation({
      itemId: item.id,
      householdId: item.household_id,
      productId: item.product_id,
      quantity: item.quantity,
      expectedLocationId: inLeg.location_id,
      newLocationId: outLeg.location_id,
      actor,
      createdAt: now,
      nowMs: Date.now(),
      reversalOf: transaction.operation_id,
      notes: undoTransactionNotes(mode, transaction.type),
    }),
  ]);
}

async function isMoveTransaction(
  db: Awaited<ReturnType<typeof getDatabase>>,
  transaction: LocalInventoryTransaction,
): Promise<boolean> {
  if (transaction.operation_legs !== undefined) {
    return isInventoryMoveTransaction(transaction);
  }
  if (transaction.operation_id === undefined || transaction.operation_id === null) return false;

  const operation = await db.getFirstAsync<{ legs: number }>(
    `select count(*) as legs
       from transactions
      where household_id = ? and operation_id = ?`,
    [transaction.household_id, transaction.operation_id],
  );
  return operation?.legs === 2;
}

export function useUndoInventoryTransactionMutation() {
  const queryClient = useQueryClient();
  const actor = useInventoryActor();
  const openUndoMutation = useUndoOpenTransactionMutation();

  return useMutation({
    mutationFn: async ({ transaction }: { transaction: LocalInventoryTransaction }) => {
      if (transaction.reversal_of !== undefined && transaction.reversal_of !== null) {
        throw new Error('Eine Gegenbuchung kann nicht erneut rückgängig gemacht werden.');
      }
      if (transaction.undone) {
        throw new Error('Diese Buchung wurde bereits rückgängig gemacht.');
      }

      if (transaction.type === 'open') {
        return openUndoMutation.mutateAsync({ transaction });
      }

      const mode = inventoryUndoMode(transaction.created_at, new Date());
      const db = await getDatabase();
      if (await isMoveTransaction(db, transaction)) {
        await enqueueMoveReversal(db, transaction, actor, mode);
      } else {
        await enqueueQuantityReversal(db, transaction, actor, mode);
      }
      return transaction.household_id;
    },
    onSuccess: (householdId) => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', householdId] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', householdId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

function invalidateAfterConflictResolution(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['inventory-conflicts'] });
  queryClient.invalidateQueries({ queryKey: ['fridge_items'] });
  queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped'] });
  queryClient.invalidateQueries({ queryKey: ['sync-status'] });
}

/** Verwirft einen dauerhaft gescheiterten Mengen-Konflikt. */
export function useDiscardInventoryConflictMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conflict: FridgeItemConflict) => {
      const db = await getDatabase();
      await discardInventoryConflict(db, getSupabase(), conflict);
    },
    onSuccess: () => invalidateAfterConflictResolution(queryClient),
  });
}

/** Bestaetigt eine abgelehnte manuelle Korrektur mit dem aktuellen Bestand neu. */
export function useReconfirmInventoryConflictMutation() {
  const queryClient = useQueryClient();
  const actor = useInventoryActor();

  return useMutation({
    mutationFn: async (conflict: FridgeItemConflict) => {
      const db = await getDatabase();
      return reconfirmInventoryQuantityCorrection(db, getSupabase(), conflict, {
        actor: actor ?? 'unknown',
        operationId: Crypto.randomUUID(),
        transactionId: Crypto.randomUUID(),
      });
    },
    onSuccess: () => invalidateAfterConflictResolution(queryClient),
  });
}
