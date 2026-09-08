import type { EnqueueMutationInput } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

export type InventoryMergeUndoPayload = {
  reversal_transaction_id: string;
  reversal_of: string;
  household_id: string;
  created_at: string;
  notes: string;
};

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Merge-Undo-Payload enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

/** Validiert den Split-Merge-Compare-and-set-Umschlag vor dem ersten Netzwerkzugriff. */
export function parseInventoryMergeUndoPayload(
  payload: Record<string, unknown>,
): InventoryMergeUndoPayload {
  return {
    reversal_transaction_id: requiredString(payload, 'reversal_transaction_id'),
    reversal_of: requiredString(payload, 'reversal_of'),
    household_id: requiredString(payload, 'household_id'),
    created_at: requiredString(payload, 'created_at'),
    notes: requiredString(payload, 'notes'),
  };
}

/** Schreibt versiegeltes Los, geoeffnetes Los und Gegenbuchung lokal atomar in einer Outbox-Operation. */
export function createInventoryMergeUndoMutation(args: {
  payload: InventoryMergeUndoPayload;
  sealedItemId: string;
  sealedQuantityAfterMerge: number;
  openedItemId: string;
  transaction: Record<string, unknown>;
  nowMs: number;
}): EnqueueMutationInput {
  const { payload, sealedItemId, sealedQuantityAfterMerge, openedItemId, transaction, nowMs } =
    args;

  return {
    entity: 'fridge_items',
    entityId: sealedItemId,
    op: 'merge_undo_open',
    payload: { ...payload },
    applyLocally: async (txn) => {
      await applyLocalMirrorWrite(
        txn,
        'fridge_items',
        'update',
        { id: sealedItemId, quantity: sealedQuantityAfterMerge },
        nowMs,
      );
      await applyLocalMirrorWrite(txn, 'fridge_items', 'delete', { id: openedItemId }, nowMs);
      await applyLocalMirrorWrite(
        txn,
        'transactions',
        'insert',
        { origin_item_id: null, origin_quantity: null, ...transaction },
        nowMs,
      );
    },
  };
}
