import type { EnqueueMutationInput } from '@/lib/db/outbox';
import { fromInventoryQuantityUnits, toInventoryQuantityUnits } from '@/lib/inventory-quantity';
import type { InventoryMovePayload, InventoryMoveTransaction } from '@/lib/sync/inventory-move';
import type { InventoryMergeUndoPayload } from '@/lib/sync/inventory-open-merge';
import type { InventorySplitPayload } from '@/lib/sync/inventory-open-split';
import {
  type InventoryQuantityCorrectionPayload,
  parseInventoryQuantityCorrectionPayload,
} from '@/lib/sync/inventory-quantity-correction';
import {
  type InventoryQuantityReversalPayload,
  parseInventoryQuantityReversalPayload,
} from '@/lib/sync/inventory-quantity-reversal';
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
  const normalizedDelta = fromInventoryQuantityUnits(toInventoryQuantityUnits(delta));

  return {
    operation_id: requiredString(payload, 'operation_id'),
    transaction_id: requiredString(payload, 'transaction_id'),
    item_id: requiredString(payload, 'item_id'),
    household_id: requiredString(payload, 'household_id'),
    delta: normalizedDelta,
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
  const normalizedResultQuantity = fromInventoryQuantityUnits(
    toInventoryQuantityUnits(resultQuantity),
  );
  if (normalizedResultQuantity < 0) {
    throw new Error('Bestandsmengen muessen nicht negativ sein.');
  }
  return {
    entity: 'fridge_items',
    entityId: payload.item_id,
    op: 'adjust_quantity',
    payload: { ...payload },
    applyLocally: async (txn) => {
      if (normalizedResultQuantity === 0) {
        await applyLocalMirrorWrite(
          txn,
          'fridge_items',
          'update',
          { id: payload.item_id, quantity: 0 },
          nowMs,
        );
        await applyLocalMirrorWrite(txn, 'fridge_items', 'delete', { id: payload.item_id }, nowMs);
      } else {
        await applyLocalMirrorWrite(
          txn,
          'fridge_items',
          'update',
          { id: payload.item_id, quantity: normalizedResultQuantity },
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

/** Schreibt Bestandskorrektur und ihre Ledgerzeile lokal atomar. */
export function createInventoryQuantityCorrectionMutation(args: {
  payload: InventoryQuantityCorrectionPayload;
  transaction: Record<string, unknown>;
  nowMs: number;
}): EnqueueMutationInput {
  const { payload, transaction, nowMs } = args;
  const correction = parseInventoryQuantityCorrectionPayload(payload);

  return {
    entity: 'fridge_items',
    entityId: correction.item_id,
    op: 'correct_quantity',
    payload: { ...correction },
    applyLocally: async (txn) => {
      await applyLocalMirrorWrite(
        txn,
        'fridge_items',
        'update',
        { id: correction.item_id, quantity: correction.new_quantity },
        nowMs,
      );
      if (correction.new_quantity === 0) {
        await applyLocalMirrorWrite(
          txn,
          'fridge_items',
          'delete',
          { id: correction.item_id },
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

/** Schreibt Rest-Los, neues geoeffnetes Los und Ledger lokal atomar in einer Outbox-Operation. */
export function createInventorySplitMutation(args: {
  payload: InventorySplitPayload;
  openedItem: Record<string, unknown>;
  transaction: Record<string, unknown>;
  nowMs: number;
}): EnqueueMutationInput {
  const { payload, openedItem, transaction, nowMs } = args;
  const remainingQuantity = fromInventoryQuantityUnits(
    toInventoryQuantityUnits(payload.expected_source_quantity) -
      toInventoryQuantityUnits(payload.open_quantity),
  );

  return {
    entity: 'fridge_items',
    entityId: payload.source_item_id,
    op: 'split_open',
    payload: { ...payload },
    applyLocally: async (txn) => {
      if (remainingQuantity === 0) {
        await applyLocalMirrorWrite(
          txn,
          'fridge_items',
          'delete',
          { id: payload.source_item_id },
          nowMs,
        );
      } else {
        await applyLocalMirrorWrite(
          txn,
          'fridge_items',
          'update',
          { id: payload.source_item_id, quantity: remainingQuantity },
          nowMs,
        );
      }
      await applyLocalMirrorWrite(
        txn,
        'fridge_items',
        'insert',
        { ...openedItem, created_at: payload.created_at },
        nowMs,
      );
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

export function createInventoryMoveMutation(args: {
  payload: InventoryMovePayload;
  outTransaction: InventoryMoveTransaction;
  inTransaction: InventoryMoveTransaction;
  nowMs: number;
}): EnqueueMutationInput {
  const { payload, outTransaction, inTransaction, nowMs } = args;
  return {
    entity: 'fridge_items',
    entityId: payload.item_id,
    op: 'move',
    payload: { ...payload },
    applyLocally: async (txn) => {
      await applyLocalMirrorWrite(
        txn,
        'fridge_items',
        'update',
        { id: payload.item_id, location_id: payload.new_location_id },
        nowMs,
      );
      await applyLocalMirrorWrite(
        txn,
        'transactions',
        'insert',
        { reversal_of: null, ...outTransaction },
        nowMs,
      );
      await applyLocalMirrorWrite(
        txn,
        'transactions',
        'insert',
        { reversal_of: null, ...inTransaction },
        nowMs,
      );
    },
  };
}
