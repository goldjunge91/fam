import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { trackAnalyticsEvent } from '@/lib/analytics';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import { normalizeUnit } from '@/lib/units';
import {
  buildInventoryOutcomeTelemetry,
  type InventoryOutcomeTelemetry,
} from './inventory-outcome';

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

export type InventoryQuantityMutationOperation = 'adjust' | 'consume' | 'remove' | 'waste';
export type InventoryWasteReason = 'expired' | 'spoiled' | 'unwanted' | 'other';

type InventoryQuantityMutationInput =
  | {
      id: string;
      household_id: string;
      delta: number;
      operation?: Exclude<InventoryQuantityMutationOperation, 'waste'>;
      wasteReason?: never;
    }
  | {
      id: string;
      household_id: string;
      delta: number;
      operation: 'waste';
      wasteReason: InventoryWasteReason;
    };

export function useAddFridgeItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Omit<FridgeItem, 'id'>) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const normUnit = normalizeUnit(item.unit);
      const normPackageUnit = item.package_size_unit ? normalizeUnit(item.package_size_unit) : null;
      const row = { id, ...item, unit: normUnit, package_size_unit: normPackageUnit };

      await enqueueMutation(db, {
        entity: 'fridge_items',
        entityId: id,
        op: 'insert',
        payload: { ...row, created_at: now, updated_at: now },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'fridge_items', 'insert', { ...row, created_at: now }, nowMs),
      });

      return id;
    },
    onSuccess: (_, variables) => {
      trackAnalyticsEvent('inventory_item.create.completed');
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.household_id] });
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

  return useMutation({
    mutationFn: async (input: InventoryQuantityMutationInput) => {
      const { id, household_id, delta, operation = 'adjust' } = input;
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const existing = await db.getFirstAsync<{ quantity: number; name: string; unit: string }>(
        'select quantity, name, unit from fridge_items where id = ?',
        [id],
      );
      if (!existing) return;

      if ((operation === 'consume' || operation === 'waste') && delta >= 0) {
        throw new Error(`${operation} requires a negative quantity delta`);
      }

      const newQty = Math.max(0, existing.quantity + delta);
      const outcomeTelemetry: InventoryOutcomeTelemetry = buildInventoryOutcomeTelemetry(
        Math.min(existing.quantity, Math.abs(delta)),
        existing.unit,
      );

      if (newQty === 0) {
        await enqueueMutation(db, {
          entity: 'fridge_items',
          entityId: id,
          op: 'delete',
          payload: { id, household_id, deleted_at: now, updated_at: now },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(txn, 'fridge_items', 'delete', { id }, nowMs),
        });
      } else {
        await enqueueMutation(db, {
          entity: 'fridge_items',
          entityId: id,
          op: 'update',
          payload: { id, household_id, quantity: newQty, updated_at: now },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(txn, 'fridge_items', 'update', { id, quantity: newQty }, nowMs),
        });
      }
      return { id, newQty, operation, outcomeTelemetry };
    },
    onSuccess: (result, variables) => {
      if (result) {
        if (variables.operation === 'consume') {
          trackAnalyticsEvent('inventory_item.consume.completed', {
            depleted: result.newQty === 0,
            ...result.outcomeTelemetry,
          });
          if (result.newQty === 0) {
            trackAnalyticsEvent('inventory_item.delete.completed');
          }
        } else if (variables.operation === 'waste') {
          trackAnalyticsEvent('inventory_item.waste.completed', {
            reason: variables.wasteReason,
            ...result.outcomeTelemetry,
          });
        } else if (variables.operation === 'remove') {
          trackAnalyticsEvent('inventory_item.delete.completed');
        } else {
          trackAnalyticsEvent('inventory_item.update.completed');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateFridgeItemMutation() {
  const queryClient = useQueryClient();

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
      };
      const payload = { ...localFields, updated_at: now };

      await enqueueMutation(db, {
        entity: 'fridge_items',
        entityId: item.id,
        op: 'update',
        payload,
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'fridge_items', 'update', localFields, nowMs),
      });
      return payload;
    },
    onSuccess: (_, variables) => {
      trackAnalyticsEvent('inventory_item.update.completed');
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['fridge_item', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
