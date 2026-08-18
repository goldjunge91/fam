import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
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

export function useAddFridgeItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Omit<FridgeItem, 'id'>) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const normUnit = normalizeUnit(item.unit);
      const normPackageUnit = item.package_size_unit ? normalizeUnit(item.package_size_unit) : null;

      await enqueueMutation(db, {
        entity: 'fridge_items',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          ...item,
          unit: normUnit,
          package_size_unit: normPackageUnit,
          created_at: now,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            `insert into fridge_items
               (id, household_id, location_id, product_id, name, quantity, unit,
                package_size, package_size_unit, expiry_date, created_at, updated_at)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              item.household_id,
              item.location_id ?? null,
              item.product_id ?? null,
              item.name,
              item.quantity,
              normUnit,
              item.package_size ?? null,
              normPackageUnit,
              item.expiry_date ?? null,
              now,
              now,
            ],
          );
        },
      });

      return id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

/**
 * Macht ein geloeschtes fridge_item rueckgaengig (#69) — setzt nur
 * `deleted_at` zurueck, ruehrt `quantity` nicht an. Der
 * Zero-Quantity-Loeschpfad in `useUpdateInventoryItemQuantityMutation` setzt
 * beim Loeschen ebenfalls nur `deleted_at`, die Menge bleibt stehen; Undo
 * spiegelt das exakt.
 *
 * Braucht den `restore`-Outbox-Op: `buildUpdatePayload()` in `push.ts`
 * filtert `deleted_at` aus jedem `update`-Push heraus, ein normales `update`
 * mit `deleted_at: null` im Payload würde also lokal wirken, aber nie zum
 * Server durchdringen.
 */
export function useRestoreFridgeItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, household_id }: { id: string; household_id: string }) => {
      const db = await getDatabase();
      const now = new Date().toISOString();

      await enqueueMutation(db, {
        entity: 'fridge_items',
        entityId: id,
        op: 'restore',
        payload: { id, household_id, deleted_at: null, updated_at: now },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update fridge_items set deleted_at = null, updated_at = ? where id = ?',
            [now, id],
          );
        },
      });

      return id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateInventoryItemQuantityMutation() {
  const queryClient = useQueryClient();

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
      const existing = await db.getFirstAsync<{ quantity: number; name: string }>(
        'select quantity, name from fridge_items where id = ?',
        [id],
      );
      if (!existing) return;

      const newQty = Math.max(0, existing.quantity + delta);

      if (newQty === 0) {
        await enqueueMutation(db, {
          entity: 'fridge_items',
          entityId: id,
          op: 'delete',
          payload: { id, household_id, deleted_at: now, updated_at: now },
          applyLocally: async (txn) => {
            await txn.runAsync(
              'update fridge_items set deleted_at = ?, updated_at = ? where id = ?',
              [now, now, id],
            );
          },
        });
      } else {
        await enqueueMutation(db, {
          entity: 'fridge_items',
          entityId: id,
          op: 'update',
          payload: { id, household_id, quantity: newQty, updated_at: now },
          applyLocally: async (txn) => {
            await txn.runAsync(
              'update fridge_items set quantity = ?, updated_at = ? where id = ?',
              [newQty, now, id],
            );
          },
        });
      }
      return { id, newQty };
    },
    onSuccess: (_, variables) => {
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
      const unit = normalizeUnit(item.unit);
      const packageSizeUnit = item.package_size_unit ? normalizeUnit(item.package_size_unit) : null;
      const payload = { ...item, unit, package_size_unit: packageSizeUnit, updated_at: now };

      await enqueueMutation(db, {
        entity: 'fridge_items',
        entityId: item.id,
        op: 'update',
        payload,
        applyLocally: async (txn) => {
          await txn.runAsync(
            `update fridge_items
             set location_id = ?, product_id = ?, name = ?, quantity = ?, unit = ?,
                 package_size = ?, package_size_unit = ?, expiry_date = ?, updated_at = ?
             where id = ?`,
            [
              item.location_id,
              item.product_id,
              item.name,
              item.quantity,
              unit,
              item.package_size,
              packageSizeUnit,
              item.expiry_date,
              now,
              item.id,
            ],
          );
        },
      });
      return payload;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['fridge_item', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
