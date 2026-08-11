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

      await enqueueMutation(db, {
        entity: 'fridge_items',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          ...item,
          unit: normUnit,
          created_at: now,
          updated_at: now,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'insert into fridge_items (id, household_id, location_id, product_id, name, quantity, unit, expiry_date, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              id,
              item.household_id,
              item.location_id ?? null,
              item.product_id ?? null,
              item.name,
              item.quantity,
              normUnit,
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
 * Zero-Quantity-Loeschpfad in `useUpdateFridgeItemQuantityMutation` setzt
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

export function useUpdateFridgeItemQuantityMutation() {
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
