import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { useStorageLocations } from '@/features/inventory/use-storage-locations';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import { normalizeUnit } from '@/lib/units';

import type { TransferItem } from './complete-run-sheet';
import type { LocalShoppingItem } from './use-shopping-list';

type CompleteShoppingRunInput = {
  householdId: string;
  /**
   * `null` statt eines erzwungenen leeren Strings: `fridge_items.added_by`/
   * `shopping_list_items.checked_by` sind nullable `uuid`-Spalten — ein
   * leerer String ist dort kein gueltiger Wert
   * ("invalid input syntax for type uuid").
   */
  userId: string | null;
  checkedItems: LocalShoppingItem[];
  transfers: TransferItem[];
};

/**
 * Schliesst den Einkauf ab (#85/#86):
 *
 * 1. Fuer jeden Transfer-Eintrag: neues `fridge_items`-Insert via Outbox
 * 2a. History-Eintrag in `shopping_history` (direkter SQLite-Insert, append-only)
 * 2b. Abgehakte Shopping-Items soft-deleten (aus der Liste entfernen via Outbox)
 *
 * Danach werden beide Caches invalidiert, sodass Einkaufsliste und
 * Vorrat-Screen sofort den neuen Zustand zeigen.
 */
export function useCompleteShoppingRun(householdId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: storageLocations } = useStorageLocations(householdId);

  return useMutation({
    mutationFn: async (input: CompleteShoppingRunInput) => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();

      // Lagerort-ID per kind nachschlagen
      function getLocationId(kind: string): string | null {
        const loc = storageLocations?.find((l) => l.kind === kind);
        return loc?.id ?? null;
      }

      // Schritt 1: fridge_items inserten
      for (const transfer of input.transfers) {
        const id = Crypto.randomUUID();
        const locationId = getLocationId(transfer.locationKind);
        const normUnit = normalizeUnit(transfer.unit);

        await enqueueMutation(db, {
          entity: 'fridge_items',
          entityId: id,
          op: 'insert',
          payload: {
            id,
            household_id: input.householdId,
            location_id: locationId,
            name: transfer.name,
            quantity: transfer.quantity,
            unit: normUnit,
            expiry_date: transfer.expiryDate ?? null,
            added_by: input.userId,
            created_at: now,
            updated_at: now,
          },
          applyLocally: async (txn) => {
            await txn.runAsync(
              `insert into fridge_items
                 (id, household_id, location_id, name, quantity, unit, expiry_date, added_by, created_at, updated_at, _dirty)
               values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [
                id,
                input.householdId,
                locationId,
                transfer.name,
                transfer.quantity,
                normUnit,
                transfer.expiryDate ?? null,
                input.userId,
                now,
                nowMs,
              ],
            );
          },
        });
      }

      // Schritt 2a: History-Eintrag anlegen (direkt via SQLite db.runAsync, da append-only und ohne Offline-Konflikte)
      for (const item of input.checkedItems) {
        const historyId = Crypto.randomUUID();
        const transfer = input.transfers.find((t) => t.shoppingItemId === item.id);

        await db.runAsync(
          `insert into shopping_history
             (id, household_id, completed_by, completed_at, item_name, quantity, unit, category, product_id, location_kind, expiry_date, created_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            historyId,
            input.householdId,
            input.userId,
            now,
            item.name,
            item.quantity,
            normalizeUnit(item.unit),
            item.category ?? null,
            item.product_id ?? null,
            transfer?.locationKind ?? null,
            transfer?.expiryDate ?? null,
            now,
          ],
        );
      }

      // Schritt 2b: Abgehakte Shopping-Items soft-deleten (aus der Liste entfernen)
      for (const item of input.checkedItems) {
        await enqueueMutation(db, {
          entity: 'shopping_list_items',
          entityId: item.id,
          op: 'delete',
          payload: {
            id: item.id,
            household_id: input.householdId,
            checked_at: now,
            checked_by: input.userId,
            deleted_at: now,
            updated_at: now,
          },
          applyLocally: async (txn) => {
            await txn.runAsync(
              'update shopping_list_items set checked_at = ?, checked_by = ?, deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
              [now, input.userId, nowMs, nowMs, item.id],
            );
          },
        });
      }
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.householdId] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.householdId] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.householdId] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
