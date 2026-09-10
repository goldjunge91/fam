import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { useSession } from '@/features/auth/session-provider';
import {
  assertValidInventoryOperation,
  createConsumeInventoryOperation,
  createCorrectQuantityOperation,
  createInsertInventoryOperation,
  createMoveInventoryOperation,
  createWasteInventoryOperation,
  type InventoryIntentLot,
} from '@/features/inventory/inventory-lifecycle';
import { calculateOpenedExpiryDate } from '@/features/inventory/opened-expiry';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getDatabase } from '@/lib/db/client';
import type { SqlDatabase } from '@/lib/db/types';
import { adjustInventoryQuantity } from '@/lib/inventory-quantity';
import {
  commitInventoryOperation,
  type InventoryCommitResult,
} from '@/lib/sync/inventory-quantity';
import { normalizeUnit } from '@/lib/units';

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
};

type LocalInventoryIntentRow = {
  quantity: number;
  product_id: string | null;
  unit: string;
  location_id: string | null;
  name: string;
  package_size: number | null;
  package_size_unit: string | null;
  expiry_date: string | null;
  opened_at: string | null;
  vacuum_sealed: boolean | number;
  expiry_user_set: boolean | number;
  added_by: string | null;
  location_kind: string | null;
};

type InventoryRecipeFields = {
  recipe_id?: string | null;
  recipe_name?: string | null;
  meal_plan_entry_id?: string | null;
};

export type ConsumeInventoryItemInput = InventoryRecipeFields & {
  item: FridgeItem;
  quantity: number;
};

export type WasteInventoryItemInput = {
  item: FridgeItem;
  reason: 'expired' | 'spoiled' | 'other';
};

function requireActor(actor: string | undefined): string {
  if (!actor) throw new Error('Kein angemeldeter Actor für die Inventory-Operation.');
  return actor;
}

function requireLocation(locationId: string | null | undefined): string {
  if (!locationId || locationId.trim().length === 0)
    throw new Error('Ein gültiger Lagerort ist für die Inventory-Operation erforderlich.');
  return locationId;
}

function operationTime(): string {
  return new Date().toISOString();
}

function operationId(): string {
  return Crypto.randomUUID();
}

function commitValidatedOperation(
  db: SqlDatabase,
  operation: unknown,
  actor: string,
): Promise<InventoryCommitResult> {
  return commitInventoryOperation(db, assertValidInventoryOperation(operation), actor);
}

function invalidateInventoryQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  householdId: string,
  itemId?: string,
): void {
  queryClient.invalidateQueries({ queryKey: ['fridge_items', householdId] });
  queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', householdId] });
  queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
  if (itemId) queryClient.invalidateQueries({ queryKey: ['fridge_item', itemId] });
  queryClient.invalidateQueries({ queryKey: ['sync-status'] });
}

function inventorySuccess(
  result: InventoryCommitResult,
  queryClient: ReturnType<typeof useQueryClient>,
  householdId: string,
  itemId: string | undefined,
  event: Parameters<typeof trackAnalyticsEvent>[0],
): void {
  if (result.kind !== 'applied' && result.kind !== 'replayed') return;
  trackAnalyticsEvent(event);
  invalidateInventoryQueries(queryClient, householdId, itemId);
}

async function readInventoryIntentRow(
  householdId: string,
  itemId: string,
): Promise<LocalInventoryIntentRow> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalInventoryIntentRow>(
    `select fi.quantity, fi.product_id, fi.unit, fi.location_id,
            fi.name, fi.package_size, fi.package_size_unit, fi.expiry_date,
            fi.opened_at, fi.vacuum_sealed, fi.expiry_user_set, fi.added_by,
            sl.kind as location_kind
       from fridge_items fi
       left join storage_locations sl on sl.id = fi.location_id
      where fi.id = ? and fi.household_id = ? and fi.deleted_at is null`,
    [itemId, householdId],
  );
  if (!row) throw new Error('Der angeforderte Bestand ist lokal nicht verfügbar.');
  requireLocation(row.location_id);
  return row;
}

function booleanField(value: boolean | number): boolean {
  return value === true || value === 1;
}

function openedExpiry(row: LocalInventoryIntentRow, openedAt: string): string {
  return calculateOpenedExpiryDate({
    name: row.name,
    locationKind: row.location_kind,
    openedAt: new Date(openedAt),
    currentExpiryDate: row.expiry_date,
    expiryUserSet: booleanField(row.expiry_user_set),
    vacuumSealed: booleanField(row.vacuum_sealed),
  });
}

function intentLot(item: FridgeItem, row: LocalInventoryIntentRow): InventoryIntentLot {
  return {
    id: item.id,
    household_id: item.household_id,
    product_id: row.product_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    package_size: row.package_size,
    package_size_unit: row.package_size_unit,
    location_id: requireLocation(row.location_id),
    expiry_date: row.expiry_date,
    opened_at: row.opened_at,
    vacuum_sealed: booleanField(row.vacuum_sealed),
    expiry_user_set: booleanField(row.expiry_user_set),
    added_by: row.added_by,
  };
}

export function useAddFridgeItemMutation() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const actor = session?.user.id;

  return useMutation<InventoryCommitResult, Error, Omit<FridgeItem, 'id'>>({
    mutationFn: async (item) => {
      const authenticatedActorId = requireActor(actor);
      const db = await getDatabase();
      const locationId = requireLocation(item.location_id);
      const operation = createInsertInventoryOperation({
        operation_id: operationId(),
        item_id: operationId(),
        in_transaction_id: operationId(),
        household_id: item.household_id,
        created_at: operationTime(),
        quantity: item.quantity,
        product_id: item.product_id,
        name: item.name,
        unit: normalizeUnit(item.unit),
        package_size: item.package_size,
        package_size_unit: item.package_size_unit
          ? normalizeUnit(item.package_size_unit)
          : item.package_size_unit,
        location_id: locationId,
        expiry_date: item.expiry_date,
      });
      return commitValidatedOperation(db, operation, authenticatedActorId);
    },
    onSuccess: (result, variables) =>
      inventorySuccess(
        result,
        queryClient,
        variables.household_id,
        undefined,
        'inventory_item.create.completed',
      ),
  });
}

export function useConsumeInventoryItemMutation() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const actor = session?.user.id;

  return useMutation<InventoryCommitResult, Error, ConsumeInventoryItemInput>({
    mutationFn: async (input) => {
      const authenticatedActorId = requireActor(actor);
      const row = await readInventoryIntentRow(input.item.household_id, input.item.id);
      const db = await getDatabase();
      const now = operationTime();
      const source = intentLot(input.item, row);
      const operation = createConsumeInventoryOperation({
        operation_id: operationId(),
        out_transaction_id: operationId(),
        opened_item_id: operationId(),
        source,
        consumed_quantity: input.quantity,
        opened_expiry_date: openedExpiry(row, now),
        created_at: now,
        recipe_id: input.recipe_id,
        recipe_name: input.recipe_name,
        meal_plan_entry_id: input.meal_plan_entry_id,
      });
      return commitValidatedOperation(db, operation, authenticatedActorId);
    },
    onSuccess: (result, variables) => {
      inventorySuccess(
        result,
        queryClient,
        variables.item.household_id,
        variables.item.id,
        'inventory_item.consume.completed',
      );
    },
  });
}

export function useWasteInventoryItemMutation() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const actor = session?.user.id;

  return useMutation<InventoryCommitResult, Error, WasteInventoryItemInput>({
    mutationFn: async ({ item, reason }) => {
      const authenticatedActorId = requireActor(actor);
      const row = await readInventoryIntentRow(item.household_id, item.id);
      const db = await getDatabase();
      return commitValidatedOperation(
        db,
        createWasteInventoryOperation({
          operation_id: operationId(),
          waste_transaction_id: operationId(),
          source: intentLot(item, row),
          reason,
          created_at: operationTime(),
        }),
        authenticatedActorId,
      );
    },
    onSuccess: (result, variables) =>
      inventorySuccess(
        result,
        queryClient,
        variables.item.household_id,
        variables.item.id,
        'inventory_item.update.completed',
      ),
  });
}

export function useUpdateInventoryItemQuantityMutation() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const actor = session?.user.id;

  return useMutation<
    InventoryCommitResult,
    Error,
    { id: string; household_id: string; delta: number }
  >({
    mutationFn: async ({ id, household_id, delta }) => {
      const authenticatedActorId = requireActor(actor);
      const row = await readInventoryIntentRow(household_id, id);
      const newQuantity = adjustInventoryQuantity(row.quantity, delta);
      if (newQuantity === row.quantity)
        throw new Error('Die Mengenänderung muss den Bestand tatsächlich ändern.');
      const db = await getDatabase();
      return commitValidatedOperation(
        db,
        createCorrectQuantityOperation({
          operation_id: operationId(),
          transaction_id: operationId(),
          source: intentLot({ id, household_id, ...row }, row),
          new_quantity: newQuantity,
          created_at: operationTime(),
        }),
        authenticatedActorId,
      );
    },
    onSuccess: (result, variables) =>
      inventorySuccess(
        result,
        queryClient,
        variables.household_id,
        variables.id,
        'inventory_item.update.completed',
      ),
  });
}

export function useMoveInventoryItemMutation() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const actor = session?.user.id;

  return useMutation<InventoryCommitResult, Error, { item: FridgeItem; locationId: string }>({
    mutationFn: async ({ item, locationId }) => {
      const authenticatedActorId = requireActor(actor);
      const expectedLocationId = requireLocation(item.location_id);
      const targetLocationId = requireLocation(locationId);
      const db = await getDatabase();
      const row = await readInventoryIntentRow(item.household_id, item.id);
      return commitValidatedOperation(
        db,
        createMoveInventoryOperation({
          operation_id: operationId(),
          out_transaction_id: operationId(),
          in_transaction_id: operationId(),
          source: { ...intentLot(item, row), location_id: expectedLocationId },
          to_location_id: targetLocationId,
          created_at: operationTime(),
        }),
        authenticatedActorId,
      );
    },
    onSuccess: (result, variables) =>
      inventorySuccess(
        result,
        queryClient,
        variables.item.household_id,
        variables.item.id,
        'inventory_item.update.completed',
      ),
  });
}
