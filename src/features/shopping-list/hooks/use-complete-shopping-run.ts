import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { celebrate } from '@/features/gamification/celebration';
import { recordActivity } from '@/features/gamification/streak';
import { useStorageLocations } from '@/features/inventory/use-storage-locations';
import type { Database } from '@/lib/database.types';
import { getDatabase } from '@/lib/db/local-client';
import {
  type EnqueueMutationInput,
  enqueueMutationStepsInExclusiveTransaction,
} from '@/lib/db/outbox';
import { isPositiveIntegerThousandths, toInventoryQuantityUnits } from '@/lib/inventory-quantity';
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

type ShoppingRunSource = Pick<
  LocalShoppingItem,
  | 'id'
  | 'household_id'
  | 'product_id'
  | 'name'
  | 'quantity'
  | 'unit'
  | 'package_size'
  | 'package_size_unit'
  | 'category_id'
  | 'category_source'
  | 'category_classifier_version'
  | 'checked_at'
> & { deleted_at: string | null };

const STORAGE_KINDS = new Set(['fridge', 'freezer', 'pantry']);

function transactionMutation(payload: TransactionDraft, nowMs: number): EnqueueMutationInput {
  if (!isPositiveIntegerThousandths(payload.quantity)) {
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

function assertIsoDate(value: string | null): void {
  if (value === null) return;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Das Mindesthaltbarkeitsdatum ist ungültig.');
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Das Mindesthaltbarkeitsdatum ist ungültig.');
  }
}

function assertOptionalPackageSize(size: number | null, unit: string | null): number | null {
  if (size === null && unit === null) return null;
  if (
    size === null ||
    !Number.isFinite(size) ||
    size <= 0 ||
    unit === null ||
    unit.trim().length === 0
  ) {
    throw new Error('Packungsgröße und Einheit müssen gemeinsam gültig sein.');
  }

  const units = toInventoryQuantityUnits(size);
  if (!isPositiveIntegerThousandths(units)) {
    throw new Error('Die Packungsgröße muss eine positive Menge sein.');
  }
  return units;
}

function assertInputs(input: CompleteShoppingRunInput): Map<string, TransferItem> {
  if (!input.householdId.trim()) throw new Error('Der Haushalt für den Einkaufsabschluss fehlt.');

  const sourcesById = new Map<string, LocalShoppingItem>();
  for (const item of input.checkedItems) {
    if (
      !item.id ||
      item.household_id !== input.householdId ||
      item.checked_at === null ||
      sourcesById.has(item.id)
    ) {
      throw new Error('Die abgehakten Artikel passen nicht zu diesem Haushalt.');
    }
    sourcesById.set(item.id, item);
  }

  if (input.transfers.length !== sourcesById.size) {
    throw new Error('Für jeden abgehakten Artikel muss genau ein Transfer vorliegen.');
  }

  const transfersById = new Map<string, TransferItem>();
  for (const transfer of input.transfers) {
    const source = sourcesById.get(transfer.shoppingItemId);
    if (!source || transfersById.has(transfer.shoppingItemId)) {
      throw new Error('Die Transfers müssen den abgehakten Artikeln eindeutig zugeordnet sein.');
    }

    if (
      transfer.productId !== source.product_id ||
      transfer.name !== source.name ||
      normalizeUnit(transfer.unit) !== normalizeUnit(source.unit) ||
      transfer.packageSize !== source.package_size ||
      transfer.packageSizeUnit !== source.package_size_unit
    ) {
      throw new Error('Der Transferinhalt stimmt nicht mehr mit dem Einkaufsartikel überein.');
    }

    if (!Number.isFinite(transfer.quantity) || transfer.quantity <= 0) {
      throw new Error('Ledger-Buchungen benötigen eine positive Menge.');
    }
    const quantityUnits = toInventoryQuantityUnits(transfer.quantity);
    if (!isPositiveIntegerThousandths(quantityUnits)) {
      throw new Error('Ledger-Buchungen benötigen eine positive Menge.');
    }

    assertOptionalPackageSize(transfer.packageSize, transfer.packageSizeUnit);
    assertIsoDate(transfer.expiryDate);
    if (!STORAGE_KINDS.has(transfer.locationKind)) {
      throw new Error('Der Lagerort für den Transfer ist ungültig.');
    }

    transfersById.set(transfer.shoppingItemId, transfer);
  }

  return transfersById;
}

export function useCompleteShoppingRun(householdId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: storageLocations } = useStorageLocations(householdId);

  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: CompleteShoppingRunInput) => {
      const transfersById = assertInputs(input);
      if (input.checkedItems.length === 0) return;

      const db = await getDatabase();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      let committed = false;

      // Lagerort-ID per kind nachschlagen
      function getLocationId(kind: string): string | null {
        const loc = storageLocations?.find((l) => l.kind === kind);
        return loc?.id ?? null;
      }

      const sourceIds = input.checkedItems.map(({ id }) => id);
      const requestedItemsById = new Map(input.checkedItems.map((item) => [item.id, item]));
      const placeholders = sourceIds.map(() => '?').join(', ');

      await enqueueMutationStepsInExclusiveTransaction(db, async (txn, append) => {
        const sources = await txn.getAllAsync<ShoppingRunSource>(
          `select id, household_id, product_id, name, quantity, unit, package_size,
                  package_size_unit, category_id, category_source,
                  category_classifier_version, checked_at, deleted_at
           from shopping_list_items
           where household_id = ? and id in (${placeholders})`,
          [input.householdId, ...sourceIds],
        );

        if (sources.length !== sourceIds.length) {
          throw new Error('Mindestens ein Einkaufsartikel ist nicht mehr verfügbar.');
        }

        if (sources.every(({ deleted_at }) => deleted_at !== null)) {
          // Ein erneuter Aufruf nach erfolgreichem Commit darf keine Zugänge erzeugen.
          return;
        }

        if (
          sources.some(({ deleted_at, checked_at }) => deleted_at !== null || checked_at === null)
        ) {
          throw new Error('Die abgehakten Artikel haben sich während des Abschlusses geändert.');
        }

        const historyRows: Array<{
          id: string;
          item: ShoppingRunSource;
          transfer: TransferItem;
        }> = [];
        const transferMutations: EnqueueMutationInput[] = [];
        const sourceMutations: EnqueueMutationInput[] = [];

        const sourcesById = new Map(sources.map((item) => [item.id, item]));
        for (const sourceId of sourceIds) {
          const item = sourcesById.get(sourceId);
          const requestedItem = requestedItemsById.get(sourceId);
          if (!item || !requestedItem) {
            throw new Error('Mindestens ein Einkaufsartikel ist nicht mehr verfügbar.');
          }
          if (item.household_id !== input.householdId) {
            throw new Error('Ein Einkaufsartikel gehört zu einem anderen Haushalt.');
          }
          if (
            item.product_id !== requestedItem.product_id ||
            item.name !== requestedItem.name ||
            item.quantity !== requestedItem.quantity ||
            item.checked_at !== requestedItem.checked_at ||
            normalizeUnit(item.unit) !== normalizeUnit(requestedItem.unit) ||
            item.package_size !== requestedItem.package_size ||
            item.package_size_unit !== requestedItem.package_size_unit
          ) {
            throw new Error('Ein Einkaufsartikel wurde während des Abschlusses geändert.');
          }

          const itemQuantityUnits = toInventoryQuantityUnits(item.quantity);
          if (!isPositiveIntegerThousandths(itemQuantityUnits)) {
            throw new Error('Die Menge eines Einkaufsartikels ist ungültig.');
          }
          const packageSizeUnits = assertOptionalPackageSize(
            item.package_size,
            item.package_size_unit,
          );
          const transfer = transfersById.get(item.id);
          if (!transfer) {
            throw new Error('Für einen abgehakten Artikel fehlt der Transfer.');
          }

          const id = Crypto.randomUUID();
          const transactionId = Crypto.randomUUID();
          const locationId = getLocationId(transfer.locationKind);
          const normUnit = normalizeUnit(item.unit);
          const quantityUnits = toInventoryQuantityUnits(transfer.quantity);
          const fridgeItem = {
            id,
            household_id: input.householdId,
            product_id: item.product_id,
            location_id: locationId,
            name: item.name,
            quantity: quantityUnits,
            unit: normUnit,
            package_size: packageSizeUnits,
            package_size_unit: item.package_size_unit,
            expiry_date: transfer.expiryDate,
            added_by: input.userId,
            opened_at: null,
            vacuum_sealed: false,
            expiry_user_set: transfer.expiryDate !== null,
            created_at: now,
          };

          transferMutations.push(
            {
              entity: 'fridge_items',
              entityId: id,
              op: 'insert',
              payload: { ...fridgeItem, updated_at: now },
              applyLocally: (handle) =>
                applyLocalMirrorWrite(handle, 'fridge_items', 'insert', fridgeItem, nowMs),
            },
            transactionMutation(
              {
                id: transactionId,
                household_id: input.householdId,
                fridge_item_id: id,
                product_id: item.product_id,
                actor: input.userId,
                type: 'in',
                quantity: quantityUnits,
                location_id: locationId,
                reason: null,
                previous_expiry_date: null,
                notes: null,
                undone: false,
                created_at: now,
              },
              nowMs,
            ),
          );

          const historyId = Crypto.randomUUID();
          historyRows.push({ id: historyId, item, transfer });

          sourceMutations.push({
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
            applyLocally: async (handle) => {
              await applyLocalMirrorWrite(
                handle,
                'shopping_list_items',
                'update',
                { id: item.id, checked_at: now, checked_by: input.userId },
                nowMs,
              );
              await applyLocalMirrorWrite(
                handle,
                'shopping_list_items',
                'delete',
                { id: item.id },
                nowMs,
              );
            },
          });
        }

        for (const { id, item, transfer } of historyRows) {
          await txn.runAsync(
            `insert into shopping_history
               (id, household_id, completed_by, completed_at, item_name, quantity, unit,
                category_id, category_source, category_classifier_version,
                product_id, location_kind, expiry_date, created_at)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              input.householdId,
              input.userId,
              now,
              item.name,
              item.quantity,
              normalizeUnit(item.unit),
              item.category_id,
              item.category_source,
              item.category_classifier_version,
              item.product_id,
              transfer.locationKind,
              transfer.expiryDate,
              now,
            ],
          );
        }

        for (const mutation of transferMutations) await append(mutation);
        for (const mutation of sourceMutations) await append(mutation);
        committed = true;
      });

      if (committed) {
        try {
          const result = recordActivity();
          if (result.milestone) {
            celebrate(`🔥 ${result.count} Tage Streak!`);
          }
        } catch {
          // Optionale Gamification darf einen bestätigten Einkaufsabschluss nicht fehlschlagen lassen.
        }
      }
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.householdId] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.householdId] });
      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.householdId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.householdId] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-shopping-needs'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-shopping-needs'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
