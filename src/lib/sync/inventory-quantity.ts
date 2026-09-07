import type { EnqueueMutationInput } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

export type InventoryQuantityAdjustmentPayload = {
  operation_id: string;
  transaction_id: string;
  item_id: string;
  household_id: string;
  delta: number;
  created_at: string;
};

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Mengen-Payload enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

/** Validiert den persistierten Delta-Umschlag vor dem Netzwerkzugriff. */
export function parseInventoryQuantityPayload(
  payload: Record<string, unknown>,
): InventoryQuantityAdjustmentPayload {
  const delta = payload.delta;
  if (typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0) {
    throw new Error('Mengen-Payload enthaelt kein gueltiges Delta.');
  }

  return {
    operation_id: requiredString(payload, 'operation_id'),
    transaction_id: requiredString(payload, 'transaction_id'),
    item_id: requiredString(payload, 'item_id'),
    household_id: requiredString(payload, 'household_id'),
    delta,
    created_at: requiredString(payload, 'created_at'),
  };
}

/**
 * Erzeugt eine atomare lokale Mengenmutation: Bestand und Ledgerzeile werden
 * zusammen mit genau einem Outbox-Eintrag committed.
 */
export function createInventoryQuantityMutation(args: {
  payload: InventoryQuantityAdjustmentPayload;
  transaction: Record<string, unknown>;
  resultQuantity: number;
  nowMs: number;
}): EnqueueMutationInput {
  const { payload, transaction, resultQuantity, nowMs } = args;
  return {
    entity: 'fridge_items',
    entityId: payload.item_id,
    op: 'adjust_quantity',
    payload: { ...payload },
    applyLocally: async (txn) => {
      if (resultQuantity === 0) {
        await applyLocalMirrorWrite(txn, 'fridge_items', 'delete', { id: payload.item_id }, nowMs);
      } else {
        await applyLocalMirrorWrite(
          txn,
          'fridge_items',
          'update',
          { id: payload.item_id, quantity: resultQuantity },
          nowMs,
        );
      }
      await applyLocalMirrorWrite(
        txn,
        'transactions',
        'insert',
        { reversal_of: null, ...transaction },
        nowMs,
      );
    },
  };
}
