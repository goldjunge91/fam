import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { useSession } from '@/features/auth/session-provider';
import { trackAnalyticsEvent } from '@/lib/analytics';
import type { Database } from '@/lib/database.types';
import { getDatabase } from '@/lib/db/client';
import { type EnqueueMutationInput, enqueueMutation, enqueueMutations } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import { normalizeUnit } from '@/lib/units';
import type { WasteReason } from './components/waste-inventory-item-sheet';
import {
  type LifecycleItem,
  planOpenInventoryItem,
  planUndoOpenTransaction,
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

type TransactionPayload = Database['public']['Tables']['transactions']['Row'];

function transactionMutation(payload: TransactionPayload, nowMs: number): EnqueueMutationInput {
  return {
    entity: 'transactions',
    entityId: payload.id,
    op: 'insert',
    payload,
    applyLocally: (txn) => applyLocalMirrorWrite(txn, 'transactions', 'insert', payload, nowMs),
  };
}

function transactionPayloadFromPlan(
  transaction: ReturnType<typeof planOpenInventoryItem>['transaction'],
  id: string,
  actor: string | null,
): TransactionPayload {
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
      const transaction: TransactionPayload = {
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
      const transaction: TransactionPayload = {
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
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const unit = normalizeUnit(item.unit);
      const packageSizeUnit = item.package_size_unit ? normalizeUnit(item.package_size_unit) : null;
      const localFields = {
        id: item.id,
        household_id: item.household_id,
        location_id: item.location_id,
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
      const payload = { ...localFields, updated_at: now };
      const existing = await db.getFirstAsync<{
        quantity: number;
        location_id: string | null;
      }>('select quantity, location_id from fridge_items where id = ?', [item.id]);
      const mutations: EnqueueMutationInput[] = [
        {
          entity: 'fridge_items',
          entityId: item.id,
          op: 'update',
          payload,
          applyLocally: (txn) =>
            applyLocalMirrorWrite(txn, 'fridge_items', 'update', localFields, nowMs),
        },
      ];

      if (existing && item.quantity !== existing.quantity) {
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
              location_id: item.location_id,
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
      if (existing && item.location_id !== existing.location_id) {
        const movement = {
          household_id: item.household_id,
          product_id: item.product_id,
          actor,
          quantity: item.quantity,
          reason: null,
          previous_expiry_date: null,
          notes: null,
          undone: false,
          created_at: now,
          fridge_item_id: item.id,
        } as const;
        mutations.push(
          transactionMutation(
            {
              id: Crypto.randomUUID(),
              ...movement,
              type: 'out',
              location_id: existing.location_id,
            },
            nowMs,
          ),
          transactionMutation(
            { id: Crypto.randomUUID(), ...movement, type: 'in', location_id: item.location_id },
            nowMs,
          ),
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
      const base = {
        household_id: item.household_id,
        product_id: item.product_id,
        actor,
        quantity: item.quantity,
        reason: null,
        previous_expiry_date: null,
        notes: null,
        undone: false,
        created_at: now,
      } as const;
      await enqueueMutations(db, [
        {
          entity: 'fridge_items',
          entityId: item.id,
          op: 'update',
          payload: {
            id: item.id,
            household_id: item.household_id,
            location_id: locationId,
            updated_at: now,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'fridge_items',
              'update',
              { id: item.id, location_id: locationId },
              nowMs,
            ),
        },
        transactionMutation(
          {
            id: Crypto.randomUUID(),
            ...base,
            fridge_item_id: item.id,
            type: 'out',
            location_id: item.location_id,
          },
          nowMs,
        ),
        transactionMutation(
          {
            id: Crypto.randomUUID(),
            ...base,
            fridge_item_id: item.id,
            type: 'in',
            location_id: locationId,
          },
          nowMs,
        ),
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
      const db = await getDatabase();
      const openedRow = await db.getFirstAsync<LocalInventoryItem>(
        `select fi.id, fi.household_id, fi.location_id, fi.product_id, fi.name,
                fi.quantity, fi.unit, fi.package_size, fi.package_size_unit,
                fi.expiry_date, fi.opened_at, fi.vacuum_sealed, fi.expiry_user_set,
                fi.added_by, fi.created_at, sl.kind as location_kind, sl.name as location_name
           from fridge_items fi
           left join storage_locations sl on fi.location_id = sl.id
          where fi.id = ? and fi.deleted_at is null`,
        [transaction.fridge_item_id],
      );
      if (!openedRow) throw new Error('Der geöffnete Bestand ist nicht mehr vorhanden.');

      const sealedRow =
        transaction.notes === '[Split]'
          ? await db.getFirstAsync<LocalInventoryItem>(
              `select fi.id, fi.household_id, fi.location_id, fi.product_id, fi.name,
                      fi.quantity, fi.unit, fi.package_size, fi.package_size_unit,
                      fi.expiry_date, fi.opened_at, fi.vacuum_sealed, fi.expiry_user_set,
                      fi.added_by, fi.created_at, sl.kind as location_kind, sl.name as location_name
                 from fridge_items fi
                 left join storage_locations sl on fi.location_id = sl.id
                where fi.household_id = ? and fi.id <> ? and fi.product_id is ?
                  and fi.location_id is ? and fi.name = ? and fi.unit = ?
                  and fi.opened_at is null and fi.expiry_date is ? and fi.deleted_at is null
                order by fi.created_at asc limit 1`,
              [
                transaction.household_id,
                transaction.fridge_item_id,
                transaction.product_id,
                transaction.location_id,
                openedRow.name,
                openedRow.unit,
                transaction.previous_expiry_date,
              ],
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
        productId: transaction.product_id,
        locationId: transaction.location_id,
        previousExpiryDate: transaction.previous_expiry_date,
        createdAt: transaction.created_at,
      };
      const plan = planUndoOpenTransaction(
        lifecycleTransaction,
        lifecycleItemFromLocal(openedRow),
        sealedRow ? lifecycleItemFromLocal(sealedRow) : null,
        new Date(),
      );
      if (plan.mode === 'fallback')
        throw new Error('Der geöffnete Bestand wurde bereits verändert.');

      const now = new Date().toISOString();
      const nowMs = Date.now();
      const mutations: EnqueueMutationInput[] = [];
      if (plan.mode === 'restore-in-place' && plan.openedPatch) {
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
      } else if (plan.mode === 'merge-split' && sealedRow && plan.sealedPatch) {
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
            previous_expiry_date: transaction.previous_expiry_date,
            notes: '[Undone] Öffnung rückgängig gemacht',
            undone: false,
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
