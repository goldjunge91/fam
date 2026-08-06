import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { normalizeUnit, useStorageLocations } from '@/features/inventory/api';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';

import type { TransferItem } from './complete-run-sheet';
import type { LocalShoppingItem } from './use-shopping-list';

type CompleteShoppingRunInput = {
  householdId: string;
  userId: string;
  checkedItems: LocalShoppingItem[];
  transfers: TransferItem[];
};

/**
 * Schliesst den Einkauf ab (#85/#86):
 *
 * 1. Fuer jeden Transfer-Eintrag: neues `fridge_items`-Insert via Outbox
 * 2. Fuer jeden gecheckte Shopping-Item: `checked_at` setzen (History behalten)
 *
 * Beide Schritte laufen sequentiell, da `enqueueMutation` intern
 * `withExclusiveTransactionAsync` benutzt — parallele Aufrufe wuerden sich
 * gegenseitig blockieren.
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

      // Schritt 2: Abgehakte Shopping-Items soft-deleten (aus der Liste entfernen).
      // History bleibt über die Outbox erhalten — der Push-Prozess schreibt den
      // Tombstone nach Supabase, wo er mit Timestamp für Auswertungen verfügbar ist.
      // Items die der User NICHT abgehakt hat (nicht erhalten) bleiben in der Liste.
      for (const item of input.checkedItems) {
        await enqueueMutation(db, {
          entity: 'shopping_list_items',
          entityId: item.id,
          op: 'delete',
          payload: {
            id: item.id,
            household_id: input.householdId,
            // checked_at/checked_by als Kontext für die History mitschicken
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
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
