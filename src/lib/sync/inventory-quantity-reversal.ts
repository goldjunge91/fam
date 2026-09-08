import type { EnqueueMutationInput } from '@/lib/db/outbox';
import { fromInventoryQuantityUnits, toInventoryQuantityUnits } from '@/lib/inventory-quantity';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

export type InventoryQuantityReversalPayload = {
  reversal_transaction_id: string;
  reversal_of: string;
  item_id: string;
  household_id: string;
  created_at: string;
  notes: string;
};

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Mengen-Undo-Payload enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

export function parseInventoryQuantityReversalPayload(
  payload: Record<string, unknown>,
): InventoryQuantityReversalPayload {
  return {
    reversal_transaction_id: requiredString(payload, 'reversal_transaction_id'),
    reversal_of: requiredString(payload, 'reversal_of'),
    item_id: requiredString(payload, 'item_id'),
    household_id: requiredString(payload, 'household_id'),
    created_at: requiredString(payload, 'created_at'),
    notes: requiredString(payload, 'notes'),
  };
}

/** Schreibt die optimistische Gegenbuchung samt Bestandszustand atomar lokal. */
export function createInventoryQuantityReversalMutation(args: {
  payload: InventoryQuantityReversalPayload;
  transaction: Record<string, unknown>;
  resultQuantity: number;
  restore: boolean;
  nowMs: number;
}): EnqueueMutationInput {
  const { payload, transaction, restore, nowMs } = args;
  const reversal = parseInventoryQuantityReversalPayload(payload);
  const resultQuantity = fromInventoryQuantityUnits(toInventoryQuantityUnits(args.resultQuantity));
  if (resultQuantity < 0) {
    throw new Error('Die Gegenbuchung würde eine negative Bestandsmenge erzeugen.');
  }

  return {
    entity: 'fridge_items',
    entityId: reversal.item_id,
    op: 'reverse_quantity',
    payload: { ...reversal },
    applyLocally: async (txn) => {
      await applyLocalMirrorWrite(
        txn,
        'fridge_items',
        'update',
        { id: reversal.item_id, quantity: resultQuantity },
        nowMs,
      );
      if (restore) {
        await applyLocalMirrorWrite(
          txn,
          'fridge_items',
          'restore',
          { id: reversal.item_id },
          nowMs,
        );
      } else if (resultQuantity === 0) {
        await applyLocalMirrorWrite(txn, 'fridge_items', 'delete', { id: reversal.item_id }, nowMs);
      }
      await applyLocalMirrorWrite(
        txn,
        'transactions',
        'insert',
        { operation_id: null, ...transaction },
        nowMs,
      );
    },
  };
}
