import type { Database } from '@/lib/database.types';
import type { EnqueueMutationInput } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

type TransactionPayload = Omit<
  Database['public']['Tables']['transactions']['Row'],
  'operation_id' | 'reversal_of' | 'sync_sequence' | 'origin_item_id' | 'origin_quantity'
> & {
  operation_id: string | null;
  reversal_of?: string | null;
  origin_item_id?: string | null;
  origin_quantity?: number | null;
};

export type InventoryMovePayload = {
  operation_id: string;
  item_id: string;
  household_id: string;
  expected_location_id: string | null;
  new_location_id: string | null;
  expected_quantity: number;
  out_transaction_id: string;
  in_transaction_id: string;
  created_at: string;
  /** Original transaction id, or original move operation id for a grouped reversal. */
  reversal_of?: string | null;
  notes?: string | null;
};

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Move-Payload enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

function nullableString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Move-Payload enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

function optionalNullableString(
  payload: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const value = payload[key];
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') {
    throw new Error(`Move-Payload enthaelt kein gueltiges Feld ${key}.`);
  }
  return value;
}

/** Validiert den persistierten Move-Umschlag vor dem ersten Netzwerkzugriff. */
export function parseInventoryMovePayload(payload: Record<string, unknown>): InventoryMovePayload {
  const expectedQuantity = payload.expected_quantity;
  if (typeof expectedQuantity !== 'number' || !Number.isFinite(expectedQuantity)) {
    throw new Error('Move-Payload enthaelt keine gueltige erwartete Menge.');
  }

  const parsed: InventoryMovePayload = {
    operation_id: requiredString(payload, 'operation_id'),
    item_id: requiredString(payload, 'item_id'),
    household_id: requiredString(payload, 'household_id'),
    expected_location_id: nullableString(payload, 'expected_location_id'),
    new_location_id: nullableString(payload, 'new_location_id'),
    expected_quantity: expectedQuantity,
    out_transaction_id: requiredString(payload, 'out_transaction_id'),
    in_transaction_id: requiredString(payload, 'in_transaction_id'),
    created_at: requiredString(payload, 'created_at'),
    reversal_of: optionalNullableString(payload, 'reversal_of'),
    notes: optionalNullableString(payload, 'notes'),
  };

  if (parsed.out_transaction_id === parsed.in_transaction_id) {
    throw new Error('Move-Payload braucht zwei unterschiedliche Ledger-IDs.');
  }
  return parsed;
}

export function createInventoryMoveMutation(args: {
  payload: InventoryMovePayload;
  outTransaction: TransactionPayload;
  inTransaction: TransactionPayload;
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
