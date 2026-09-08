import type { EnqueueMutationInput } from '@/lib/db/outbox';
import {
  assertInventoryQuantityPrecision,
  isNonNegativeIntegerThousandths,
  isPositiveIntegerThousandths,
} from '@/lib/inventory-quantity';
import type { InventoryMovePayload, InventoryMoveTransaction } from '@/lib/sync/inventory-move';
import type { InventoryMergeUndoPayload } from '@/lib/sync/inventory-open-merge';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

export type InventoryQuantityAdjustmentPayload = {
  operation_id: string;
  transaction_id: string;
  item_id: string;
  household_id: string;
  delta: number;
  created_at: string;
};

export type InventoryQuantityCorrectionPayload = {
  operation_id: string;
  transaction_id: string;
  item_id: string;
  household_id: string;
  expected_quantity: number;
  new_quantity: number;
  created_at: string;
};

/** Gemeinsamer Payload-Validator aller lokalen Mengen-Befehle (contract.md Abschnitt 8). */
function requiredString(payload: Record<string, unknown>, key: string, context: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${context} enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

/** Wie requiredString, aber fuer eine Integer-Tausendstel-Menge (contract.md Abschnitt 3). */
function requiredNonNegativeQuantityUnits(
  payload: Record<string, unknown>,
  key: string,
  context: string,
): number {
  const value = payload[key];
  if (!isNonNegativeIntegerThousandths(value)) {
    throw new Error(`${context} enthaelt keine gueltige Menge ${key}.`);
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
  const normalizedDelta = assertInventoryQuantityPrecision(delta);

  return {
    operation_id: requiredString(payload, 'operation_id', 'Mengen-Payload'),
    transaction_id: requiredString(payload, 'transaction_id', 'Mengen-Payload'),
    item_id: requiredString(payload, 'item_id', 'Mengen-Payload'),
    household_id: requiredString(payload, 'household_id', 'Mengen-Payload'),
    delta: normalizedDelta,
    created_at: requiredString(payload, 'created_at', 'Mengen-Payload'),
  };
}

export type InventoryQuantityReversalPayload = {
  reversal_transaction_id: string;
  reversal_of: string;
  item_id: string;
  household_id: string;
  created_at: string;
  notes: string;
};

/** Wie requiredString, aber fuer eine positive Integer-Tausendstel-Menge. */
function requiredQuantityUnits(
  payload: Record<string, unknown>,
  key: string,
  context: string,
): number {
  const value = payload[key];
  if (!isPositiveIntegerThousandths(value)) {
    throw new Error(`${context} enthaelt keine gueltige Menge ${key}.`);
  }
  return value;
}

function requiredBoolean(payload: Record<string, unknown>, key: string, context: string): boolean {
  const value = payload[key];
  if (typeof value !== 'boolean') {
    throw new Error(`${context} enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

export type InventorySplitPayload = {
  transaction_id: string;
  source_item_id: string;
  opened_item_id: string;
  household_id: string;
  expected_source_quantity: number;
  open_quantity: number;
  opened_at: string;
  new_expiry_date: string | null;
  expiry_user_set: boolean;
  created_at: string;
};

/** Validiert den Split-Compare-and-set-Umschlag vor dem Netzwerkzugriff (fam-lem.27.8). */
export function parseInventorySplitPayload(
  payload: Record<string, unknown>,
): InventorySplitPayload {
  const context = 'Split-Payload';
  const expectedSourceQuantity = requiredQuantityUnits(
    payload,
    'expected_source_quantity',
    context,
  );
  const openQuantity = requiredQuantityUnits(payload, 'open_quantity', context);
  if (openQuantity > expectedSourceQuantity) {
    throw new Error('Die Öffnungsmenge muss größer als 0 und höchstens die Ausgangsmenge sein.');
  }

  const newExpiryDateRaw = payload.new_expiry_date;
  if (newExpiryDateRaw !== null && typeof newExpiryDateRaw !== 'string') {
    throw new Error(`${context} enthaelt kein gueltiges Feld new_expiry_date.`);
  }

  const parsed: InventorySplitPayload = {
    transaction_id: requiredString(payload, 'transaction_id', context),
    source_item_id: requiredString(payload, 'source_item_id', context),
    opened_item_id: requiredString(payload, 'opened_item_id', context),
    household_id: requiredString(payload, 'household_id', context),
    expected_source_quantity: expectedSourceQuantity,
    open_quantity: openQuantity,
    opened_at: requiredString(payload, 'opened_at', context),
    new_expiry_date: newExpiryDateRaw,
    expiry_user_set: requiredBoolean(payload, 'expiry_user_set', context),
    created_at: requiredString(payload, 'created_at', context),
  };

  if (parsed.source_item_id === parsed.opened_item_id) {
    throw new Error(`${context} braucht zwei unterschiedliche Bestands-IDs.`);
  }
  return parsed;
}

/** Validiert den persistierten Reversal-Umschlag vor dem Netzwerkzugriff (fam-lem.27.7). */
export function parseInventoryQuantityReversalPayload(
  payload: Record<string, unknown>,
): InventoryQuantityReversalPayload {
  const context = 'Mengen-Undo-Payload';
  return {
    reversal_transaction_id: requiredString(payload, 'reversal_transaction_id', context),
    reversal_of: requiredString(payload, 'reversal_of', context),
    item_id: requiredString(payload, 'item_id', context),
    household_id: requiredString(payload, 'household_id', context),
    created_at: requiredString(payload, 'created_at', context),
    notes: requiredString(payload, 'notes', context),
  };
}

/** Validiert den Compare-and-set-Umschlag vor dem Netzwerkzugriff (fam-lem.27.6). */
export function parseInventoryQuantityCorrectionPayload(
  payload: Record<string, unknown>,
): InventoryQuantityCorrectionPayload {
  const context = 'Mengenkorrektur-Payload';
  const expectedQuantity = requiredNonNegativeQuantityUnits(payload, 'expected_quantity', context);
  const newQuantity = requiredNonNegativeQuantityUnits(payload, 'new_quantity', context);
  if (expectedQuantity === newQuantity) {
    throw new Error('Mengenkorrektur braucht zwei unterschiedliche Mengen.');
  }

  return {
    operation_id: requiredString(payload, 'operation_id', context),
    transaction_id: requiredString(payload, 'transaction_id', context),
    item_id: requiredString(payload, 'item_id', context),
    household_id: requiredString(payload, 'household_id', context),
    expected_quantity: expectedQuantity,
    new_quantity: newQuantity,
    created_at: requiredString(payload, 'created_at', context),
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
  const normalizedResultQuantity = assertInventoryQuantityPrecision(resultQuantity);
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
  // Integer-nativ (fam-lem.27.7): der Aufrufer liefert bereits Integer-
  // Tausendstel, keine Dezimal-Rueckkonvertierung mehr vor dem Schreiben.
  if (!isNonNegativeIntegerThousandths(args.resultQuantity)) {
    throw new Error('Die Gegenbuchung würde eine negative Bestandsmenge erzeugen.');
  }
  const resultQuantity = args.resultQuantity;

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
  // Integer-nativ (fam-lem.27.8): payload traegt bereits Integer-Tausendstel,
  // keine Dezimal-Rueckkonvertierung mehr. Das neue Los erhaelt exakt die
  // validierte Oeffnungsmenge, nicht das (moeglicherweise noch dezimale)
  // quantity-Feld des gelieferten Lifecycle-Plans.
  const remainingQuantity = payload.expected_source_quantity - payload.open_quantity;

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
        { ...openedItem, quantity: payload.open_quantity, created_at: payload.created_at },
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
