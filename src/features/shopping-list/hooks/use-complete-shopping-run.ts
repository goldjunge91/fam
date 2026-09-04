import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { useStorageLocations } from '@/features/inventory/use-storage-locations';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import { recordActivity } from '@/lib/streak';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import { normalizeUnit } from '@/lib/units';

import type { TransferItem } from '../sheets/complete-run-sheet';
import type { LocalShoppingItem } from './use-shopping-list';

type CompleteShoppingRunInput = {
  householdId: string;

  userId: string | null;
  checkedItems: LocalShoppingItem[];
  transfers: TransferItem[];
};

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
            product_id: transfer.productId,
            location_id: locationId,
            name: transfer.name,
            quantity: transfer.quantity,
            unit: normUnit,
            package_size: transfer.packageSize,
            package_size_unit: transfer.packageSizeUnit,
            expiry_date: transfer.expiryDate ?? null,
            added_by: input.userId,
            created_at: now,
            updated_at: now,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'fridge_items',
              'insert',
              {
                id,
                household_id: input.householdId,
                product_id: transfer.productId,
                location_id: locationId,
                name: transfer.name,
                quantity: transfer.quantity,
                unit: normUnit,
                package_size: transfer.packageSize,
                package_size_unit: transfer.packageSizeUnit,
                expiry_date: transfer.expiryDate ?? null,
                added_by: input.userId,
                created_at: now,
              },
              nowMs,
            ),
        });
      }

      for (const item of input.checkedItems) {
        const historyId = Crypto.randomUUID();
        const transfer = input.transfers.find((t) => t.shoppingItemId === item.id);

        await db.runAsync(
          `insert into shopping_history
             (id, household_id, completed_by, completed_at, item_name, quantity, unit,
              category_id, category_source, category_classifier_version,
              product_id, location_kind, expiry_date, created_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            historyId,
            input.householdId,
            input.userId,
            now,
            item.name,
            item.quantity,
            normalizeUnit(item.unit),
            item.category_id,
            item.category_source,
            item.category_classifier_version,
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
          // Zwei Aufrufe statt einer kombinierten SQL: applyLocalMirrorWrite()
          // trennt bewusst "Felder setzen" (update) von "Soft-Delete"
          // (delete/restore ruehren nur deleted_at an) — beide laufen in
          // derselben Transaktion (enqueueMutation), das Endergebnis ist
          // dieselbe Zeile wie vorher mit dem kombinierten Statement.
          applyLocally: async (txn) => {
            await applyLocalMirrorWrite(
              txn,
              'shopping_list_items',
              'update',
              { id: item.id, checked_at: now, checked_by: input.userId },
              nowMs,
            );
            await applyLocalMirrorWrite(
              txn,
              'shopping_list_items',
              'delete',
              { id: item.id },
              nowMs,
            );
          },
        });
      }

      if (input.checkedItems.length > 0) recordActivity();
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.householdId] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.householdId] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.householdId] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
