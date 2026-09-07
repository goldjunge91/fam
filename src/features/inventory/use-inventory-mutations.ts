import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { useSession } from '@/features/auth/session-provider';
import { trackAnalyticsEvent } from '@/lib/analytics';
import type { Database } from '@/lib/database.types';
import { getDatabase } from '@/lib/db/client';
import { type EnqueueMutationInput, enqueueMutation, enqueueMutations } from '@/lib/db/outbox';
import { createInventoryMoveMutation } from '@/lib/sync/inventory-move';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
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
import type { LocalInventoryTransaction } from './use-inventory-transactions';

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
  'operation_id' | 'reversal_of'
> & {
  operation_id: string | null;
  reversal_of: string | null;
};
type TransactionDraft = Omit<TransactionPayload, 'operation_id' | 'reversal_of'> & {
  operation_id?: string | null;
  reversal_of?: string | null;
};

function transactionMutation(payload: TransactionDraft, nowMs: number): EnqueueMutationInput {
  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    throw new Error('Ledger-Buchungen benötigen eine positive Menge.');
  }

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
      const existing = await db.getFirstAsync<{
        quantity: number;
        name: string;
        product_id: string | null;
        location_id: string | null;
        expiry_date: string | null;
      }>(
        'select quantity, name, product_id, location_id, expiry_date from fridge_items where id = ?',
        [id],
      );
      if (!existing) return;

      const newQty = Math.max(0, existing.quantity + delta);
      const changedQty = Math.abs(newQty - existing.quantity);
      if (changedQty === 0) return { id, newQty };
      const transactionId = Crypto.randomUUID();
      const transaction: TransactionDraft = {
        id: transactionId,
        household_id,
        fridge_item_id: id,
        product_id: existing.product_id,
        actor,
        type: delta < 0 ? 'out' : 'in',
        quantity: changedQty,
        location_id: existing.location_id,
        reason: null,
        previous_expiry_date: null,
        notes: null,
        undone: false,
        created_at: now,
      };

      if (newQty === 0) {
        await enqueueMutations(db, [
          {
            entity: 'fridge_items',
            entityId: id,
            op: 'delete',
            payload: { id, household_id, deleted_at: now, updated_at: now },
            applyLocally: (txn) =>
              applyLocalMirrorWrite(txn, 'fridge_items', 'delete', { id }, nowMs),
          },
          transactionMutation(transaction, nowMs),
        ]);
      } else {
        await enqueueMutations(db, [
          {
            entity: 'fridge_items',
            entityId: id,
            op: 'update',
            payload: { id, household_id, quantity: newQty, updated_at: now },
            applyLocally: (txn) =>
              applyLocalMirrorWrite(txn, 'fridge_items', 'update', { id, quantity: newQty }, nowMs),
          },
          transactionMutation(transaction, nowMs),
        ]);
      }
      return { id, newQty };
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

export function useUpdateFridgeItemMutation() {
  const queryClient = useQueryClient();
  const actor = useInventoryActor();

  return useMutation({
    mutationFn: async (item: FridgeItem) => {
      assertValidInventoryQuantity(item.quantity);
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const unit = normalizeUnit(item.unit);
      const packageSizeUnit = item.package_size_unit ? normalizeUnit(item.package_size_unit) : null;
      const localFieldsWithoutLocation = {
        id: item.id,
        household_id: item.household_id,
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit,
        package_size: item.package_size,
        package_size_unit: packageSizeUnit,
        expiry_date: item.expiry_date,
        ...(item.opened_at !== undefined ? { opened_at: item.opened_at } : {}),
        ...(item.vacuum_sealed !== undefined ? { vacuum_sealed: item.vacuum_sealed } : {}),
        ...(item.expiry_user_set !== undefined ? { expiry_user_set: item.expiry_user_set } : {}),
      };
      const existing = await db.getFirstAsync<{
        quantity: number;
        location_id: string | null;
      }>('select quantity, location_id from fridge_items where id = ?', [item.id]);
      if (!existing) {
        throw new Error('Der Bestand ist lokal nicht vorhanden.');
      }

      const quantityChanged = existing !== null && item.quantity !== existing.quantity;
      const isDepleted = item.quantity === 0 && quantityChanged;
      const locationChanged =
        existing !== null && item.quantity > 0 && item.location_id !== existing.location_id;
      const localFields = locationChanged
        ? localFieldsWithoutLocation
        : { ...localFieldsWithoutLocation, location_id: item.location_id };
      const payload = { ...localFields, updated_at: now };
      const mutations: EnqueueMutationInput[] = [
        isDepleted
          ? {
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
            }
          : {
              entity: 'fridge_items',
              entityId: item.id,
              op: 'update',
              payload,
              applyLocally: (txn) =>
                applyLocalMirrorWrite(txn, 'fridge_items', 'update', localFields, nowMs),
            },
      ];

      if (quantityChanged) {
        mutations.push(
          transactionMutation(
            {
              id: Crypto.randomUUID(),
              household_id: item.household_id,
              fridge_item_id: item.id,
              product_id: item.product_id,
              actor,
              type: item.quantity > existing.quantity ? 'in' : 'out',
              quantity: Math.abs(item.quantity - existing.quantity),
              location_id: isDepleted ? existing.location_id : item.location_id,
              reason: null,
              previous_expiry_date: null,
              notes: '[Manual correction]',
              undone: false,
              created_at: now,
            },
            nowMs,
          ),
        );
      }
      if (locationChanged && existing) {
        mutations.push(
          groupedMoveMutation({
            itemId: item.id,
            householdId: item.household_id,
            productId: item.product_id,
            quantity: item.quantity,
            expectedLocationId: existing.location_id,
            newLocationId: item.location_id,
            actor,
            createdAt: now,
            nowMs,
          }),
        );
      }

      await enqueueMutations(db, mutations);
      return payload;
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
      const plan = planOpenInventoryItem(lifecycleItemFromLocal(item), quantity, now, openedItemId);
      const transaction = transactionPayloadFromPlan(plan.transaction, transactionId, actor);
      const originalPatch = lifecyclePatchPayload(plan.originalPatch);
      const originalPayload = { id: item.id, household_id: item.household_id, ...originalPatch };
      const mutations: EnqueueMutationInput[] = [];

      if (quantity === item.quantity && item.quantity > 1) {
        mutations.push({
          entity: 'fridge_items',
          entityId: item.id,
          op: 'delete',
          payload: {
            id: item.id,
            household_id: item.household_id,
            deleted_at: nowIso,
            updated_at: nowIso,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(txn, 'fridge_items', 'delete', { id: item.id }, nowMs),
        });
      } else {
        mutations.push({
          entity: 'fridge_items',
          entityId: item.id,
          op: 'update',
          payload: { ...originalPayload, updated_at: nowIso },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'fridge_items',
              'update',
              { id: item.id, ...originalPatch },
              nowMs,
            ),
        });
      }

      if (plan.openedItem) {
        const openedPayload = lifecycleItemPayload(plan.openedItem);
        mutations.push({
          entity: 'fridge_items',
          entityId: openedItemId,
          op: 'insert',
          payload: { ...openedPayload, created_at: nowIso, updated_at: nowIso },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'fridge_items',
              'insert',
              { ...openedPayload, created_at: nowIso },
              nowMs,
            ),
        });
      }

      mutations.push(transactionMutation(transaction, nowMs));
      await enqueueMutations(db, mutations);
      return { itemId: item.id, openedItemId: plan.openedItem?.id ?? item.id };
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
      const existingUndo = await db.getFirstAsync<{ id: string }>(
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

      const openedRow = await db.getFirstAsync<LocalInventoryItem>(
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

      const splitOriginItemId = getSplitOriginItemId({ notes: transaction.notes });
      const sealedRow = splitOriginItemId
        ? await db.getFirstAsync<LocalInventoryItem>(
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
        productId: transaction.product_id,
        locationId: transaction.location_id,
        previousExpiryDate: transaction.previous_expiry_date,
        createdAt: transaction.created_at,
      };
      const undoMode = inventoryUndoMode(transaction.created_at, new Date());
      const plan =
        undoMode === 'undo'
          ? planUndoOpenTransaction(
              lifecycleTransaction,
              lifecycleItemFromLocal(openedRow),
              sealedRow ? lifecycleItemFromLocal(sealedRow) : null,
              new Date(),
            )
          : null;

      const now = new Date().toISOString();
      const nowMs = Date.now();
      const mutations: EnqueueMutationInput[] = [];
      if (undoMode === 'manual-correction') {
        if (openedRow.opened_at === null) {
          throw new Error('Der geöffnete Bestand wurde bereits verändert.');
        }
        const patch = {
          opened_at: null,
          expiry_date: transaction.previous_expiry_date,
          expiry_user_set: transaction.previous_expiry_date !== null,
        };
        mutations.push({
          entity: 'fridge_items',
          entityId: openedRow.id,
          op: 'update',
          payload: {
            id: openedRow.id,
            household_id: openedRow.household_id,
            ...patch,
            updated_at: now,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'fridge_items',
              'update',
              { id: openedRow.id, ...patch },
              nowMs,
            ),
        });
      } else if (plan?.mode === 'restore-in-place' && plan.openedPatch) {
        const patch = lifecyclePatchPayload(plan.openedPatch);
        mutations.push({
          entity: 'fridge_items',
          entityId: openedRow.id,
          op: 'update',
          payload: {
            id: openedRow.id,
            household_id: openedRow.household_id,
            ...patch,
            updated_at: now,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'fridge_items',
              'update',
              { id: openedRow.id, ...patch },
              nowMs,
            ),
        });
      } else if (plan?.mode === 'merge-split' && sealedRow && plan.sealedPatch) {
        mutations.push({
          entity: 'fridge_items',
          entityId: sealedRow.id,
          op: 'update',
          payload: {
            id: sealedRow.id,
            household_id: sealedRow.household_id,
            quantity: plan.sealedPatch.quantity,
            updated_at: now,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'fridge_items',
              'update',
              { id: sealedRow.id, quantity: plan.sealedPatch?.quantity },
              nowMs,
            ),
        });
        mutations.push({
          entity: 'fridge_items',
          entityId: openedRow.id,
          op: 'delete',
          payload: {
            id: openedRow.id,
            household_id: openedRow.household_id,
            deleted_at: now,
            updated_at: now,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(txn, 'fridge_items', 'delete', { id: openedRow.id }, nowMs),
        });
      } else if (plan?.mode === 'fallback') {
        // Der Split-Ursprung wurde nach dem Öffnen verändert. Der Undo bleibt
        // deshalb als Provenienzbuchung erhalten, ändert aber kein Lot.
      }
      mutations.push(
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
            notes: undoTransactionNotes(undoMode, 'open'),
            undone: false,
            reversal_of: transaction.id,
            created_at: now,
          },
          nowMs,
        ),
      );
      await enqueueMutations(db, mutations);
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

  const item = await db.getFirstAsync<UndoInventoryItem>(
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

  const existingReversal = await db.getFirstAsync<{ id: string }>(
    `select id from transactions where household_id = ? and reversal_of = ? limit 1`,
    [transaction.household_id, transaction.id],
  );
  if (existingReversal) throw new Error('Diese Buchung wurde bereits rückgängig gemacht.');

  const inverseType = inverseTransactionType(transaction.type);
  if (inverseType === 'open') {
    throw new Error('Öffnungen werden über den Open-Undo-Pfad behandelt.');
  }

  const now = new Date().toISOString();
  const nowMs = Date.now();
  const mutations: EnqueueMutationInput[] = [];

  if (item.deleted_at !== null) {
    if (transaction.type === 'in' || item.quantity !== transaction.quantity) {
      throw new Error('Der Bestand wurde zwischenzeitlich verändert.');
    }
    mutations.push({
      entity: 'fridge_items',
      entityId: item.id,
      op: 'restore',
      payload: { id: item.id, household_id: item.household_id, deleted_at: null, updated_at: now },
      applyLocally: (txn) =>
        applyLocalMirrorWrite(txn, 'fridge_items', 'restore', { id: item.id }, nowMs),
    });
  } else {
    const nextQuantity =
      inverseType === 'out'
        ? item.quantity - transaction.quantity
        : item.quantity + transaction.quantity;
    if (nextQuantity < 0) {
      throw new Error('Die Gegenbuchung würde eine negative Bestandsmenge erzeugen.');
    }
    if (nextQuantity === 0) {
      mutations.push({
        entity: 'fridge_items',
        entityId: item.id,
        op: 'delete',
        payload: { id: item.id, household_id: item.household_id, deleted_at: now, updated_at: now },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'fridge_items', 'delete', { id: item.id }, nowMs),
      });
    } else {
      mutations.push({
        entity: 'fridge_items',
        entityId: item.id,
        op: 'update',
        payload: {
          id: item.id,
          household_id: item.household_id,
          quantity: nextQuantity,
          updated_at: now,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'fridge_items',
            'update',
            { id: item.id, quantity: nextQuantity },
            nowMs,
          ),
      });
    }
  }

  mutations.push(
    transactionMutation(
      {
        id: Crypto.randomUUID(),
        household_id: transaction.household_id,
        fridge_item_id: item.id,
        product_id: transaction.product_id ?? item.product_id,
        actor,
        type: inverseType,
        quantity: transaction.quantity,
        location_id: item.location_id ?? transaction.location_id,
        reason: null,
        previous_expiry_date: null,
        notes: undoTransactionNotes(mode, transaction.type),
        undone: false,
        reversal_of: transaction.id,
        created_at: now,
      },
      nowMs,
    ),
  );
  await enqueueMutations(db, mutations);
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
      if (transaction.operation_id) {
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
