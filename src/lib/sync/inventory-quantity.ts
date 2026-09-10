import {
  areInventoryOperationRequestsEqual,
  computeInventoryOperationFootprint,
  type InventoryConflictCode,
  type InventoryLedgerWrite,
  type InventoryLotState,
  type InventoryLotWrite,
  type InventoryOperationFootprint,
  type InventoryOperationV1,
  type InventoryPlanningState,
  type InventoryTransactionState,
  planInventoryOperation,
  validateInventoryOperation,
} from '@/features/inventory/inventory-lifecycle';
import {
  type EnqueueMutationInput,
  enqueueMutationsInExclusiveTransaction,
  parseOutboxEntry,
} from '@/lib/db/outbox';
import type { OutboxEntry, SqlDatabase, SqlParam } from '@/lib/db/types';
import { applyLocalMirrorWrite } from './mirror-write';

export type InventoryOperationEnvelope = {
  contract_version: 1;
  operation_id: string;
  actor_id: string;
  request: InventoryOperationV1;
  footprint: InventoryOperationFootprint;
};

export type InventoryCommitResult =
  | {
      kind: 'applied';
      operation_id: string;
      footprint: InventoryOperationFootprint;
      outbox_count: number;
    }
  | { kind: 'replayed'; operation_id: string; footprint: InventoryOperationFootprint }
  | { kind: 'conflict'; operation_id: string; code: InventoryConflictCode };

type LocalLotRow = {
  id: string;
  household_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  package_size: number | null;
  package_size_unit: string | null;
  location_id: string;
  expiry_date: string | null;
  opened_at: string | null;
  vacuum_sealed: boolean | number;
  expiry_user_set: boolean | number;
  added_by: string | null;
  created_at: string | null;
  updated_at: number;
  deleted_at: number | null;
};

type LocalTransactionRow = {
  id: string;
  operation_id: string;
  household_id: string;
  fridge_item_id: string;
  product_id: string | null;
  actor: string | null;
  type: 'in' | 'out' | 'waste';
  quantity: number;
  unit: string;
  location_id: string;
  reason: 'expired' | 'spoiled' | 'other' | null;
  notes: string | null;
  reversal_of: string | null;
  created_at: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

function isFootprint(value: unknown): value is InventoryOperationFootprint {
  if (!isRecord(value) || !isRecord(value.lots) || !isRecord(value.ledger)) return false;
  return (
    isStringArray(value.lots.read) &&
    isStringArray(value.lots.created) &&
    isStringArray(value.lots.updated) &&
    isStringArray(value.lots.restored) &&
    isStringArray(value.lots.tombstoned) &&
    isStringArray(value.ledger.read) &&
    isStringArray(value.ledger.created) &&
    isStringArray(value.ledger.reversed)
  );
}

export function readInventoryOperationEnvelope(
  entry: OutboxEntry,
): InventoryOperationEnvelope | null {
  const payload = parseOutboxEntry(entry);
  const value = payload.inventory_operation;
  if (!isRecord(value) || value.contract_version !== 1) return null;
  if (
    typeof value.operation_id !== 'string' ||
    typeof value.actor_id !== 'string' ||
    !isRecord(value.request)
  )
    return null;
  if (!isFootprint(value.footprint)) return null;
  const request = validateInventoryOperation(value.request);
  if (!request.success || request.data.operation_id !== value.operation_id) return null;
  return {
    contract_version: 1,
    operation_id: value.operation_id,
    actor_id: value.actor_id,
    request: request.data,
    footprint: value.footprint,
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isoTimestamp(value: number, field: string): string {
  if (!Number.isFinite(value)) throw new Error(`Lokaler ${field}-Zeitstempel ist ungueltig.`);
  return new Date(value).toISOString();
}

function boolValue(value: boolean | number, field: string): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 0) return false;
  if (value === 1) return true;
  throw new Error(`Lokaler Boolean-Wert fuer ${field} ist ungueltig.`);
}

function mapLot(row: LocalLotRow): InventoryLotState {
  if (row.created_at === null) throw new Error(`Lot ${row.id} hat keinen created_at.`);
  return {
    id: row.id,
    household_id: row.household_id,
    product_id: row.product_id,
    name: row.name,
    unit: row.unit,
    quantity: row.quantity,
    package_size: row.package_size,
    package_size_unit: row.package_size_unit,
    location_id: row.location_id,
    expiry_date: row.expiry_date,
    opened_at: row.opened_at,
    vacuum_sealed: boolValue(row.vacuum_sealed, 'vacuum_sealed'),
    expiry_user_set: boolValue(row.expiry_user_set, 'expiry_user_set'),
    added_by: row.added_by,
    created_at: row.created_at,
    updated_at: isoTimestamp(row.updated_at, 'updated_at'),
    deleted_at: row.deleted_at === null ? null : isoTimestamp(row.deleted_at, 'deleted_at'),
  };
}

function mapTransaction(row: LocalTransactionRow): InventoryTransactionState {
  if (row.created_at === null) throw new Error(`Ledger ${row.id} hat keinen created_at.`);
  return {
    id: row.id,
    operation_id: row.operation_id,
    reversal_of: row.reversal_of,
    household_id: row.household_id,
    fridge_item_id: row.fridge_item_id,
    product_id: row.product_id,
    actor: row.actor,
    type: row.type,
    quantity: row.quantity,
    unit: row.unit,
    location_id: row.location_id,
    reason: row.reason,
    notes: row.notes,
    created_at: row.created_at,
  };
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

async function loadLots(txn: SqlDatabase, ids: readonly string[]): Promise<InventoryLotState[]> {
  if (ids.length === 0) return [];
  const rows = await txn.getAllAsync<LocalLotRow>(
    `select * from fridge_items where id in (${placeholders(ids.length)})`,
    ids,
  );
  return rows.map(mapLot);
}

async function loadTransactions(
  txn: SqlDatabase,
  householdId: string,
  lotIds: readonly string[],
  ledgerIds: readonly string[],
): Promise<InventoryTransactionState[]> {
  if (lotIds.length === 0 && ledgerIds.length === 0) return [];
  const clauses: string[] = [];
  const params: SqlParam[] = [];
  if (lotIds.length > 0) {
    clauses.push(`(household_id = ? and fridge_item_id in (${placeholders(lotIds.length)}))`);
    params.push(householdId, ...lotIds);
  }
  if (ledgerIds.length > 0) {
    clauses.push(`id in (${placeholders(ledgerIds.length)})`);
    params.push(...ledgerIds);
  }
  const rows = await txn.getAllAsync<LocalTransactionRow>(
    `select * from transactions where ${clauses.join(' or ')}`,
    params,
  );
  return rows.map(mapTransaction);
}

async function loadRelevantEnvelopes(
  txn: SqlDatabase,
  operationId: string,
  entityIds: readonly string[],
): Promise<InventoryOperationEnvelope[]> {
  const clauses: string[] = [];
  const params: SqlParam[] = [];
  if (entityIds.length > 0) {
    clauses.push(
      `(entity in ('fridge_items', 'transactions') and entity_id in (${placeholders(entityIds.length)}))`,
    );
    params.push(...entityIds);
  }
  clauses.push(`payload like ?`);
  params.push(`%"operation_id":"${operationId}"%`);
  const rows = await txn.getAllAsync<OutboxEntry>(
    `select * from outbox where ${clauses.map((clause) => `(${clause})`).join(' or ')} order by id asc`,
    params,
  );
  const envelopes: InventoryOperationEnvelope[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const envelope = readInventoryOperationEnvelope(row);
    if (envelope && !seen.has(envelope.operation_id)) {
      seen.add(envelope.operation_id);
      envelopes.push(envelope);
    }
  }
  return envelopes;
}

function envelopePayload(
  payload: Record<string, unknown>,
  operation: InventoryOperationV1,
  authenticatedActorId: string,
  footprint: InventoryOperationFootprint,
): Record<string, unknown> {
  return {
    ...payload,
    household_id: operation.household_id,
    inventory_operation: {
      contract_version: 1,
      operation_id: operation.operation_id,
      actor_id: authenticatedActorId,
      request: operation,
      footprint,
    },
  };
}

function lotPayload(write: InventoryLotWrite): Record<string, unknown> {
  return { id: write.item_id, ...write.patch };
}

function lotOutboxOp(kind: InventoryLotWrite['kind']): EnqueueMutationInput['op'] {
  if (kind === 'create') return 'insert';
  if (kind === 'tombstone') return 'delete';
  if (kind === 'restore') return 'restore';
  return 'update';
}

function ledgerPayload(write: InventoryLedgerWrite): Record<string, unknown> {
  const transaction = write.transaction;
  return {
    id: transaction.id,
    operation_id: transaction.operation_id,
    household_id: transaction.household_id,
    fridge_item_id: transaction.fridge_item_id,
    product_id: transaction.product_id,
    actor: transaction.actor,
    type: transaction.type,
    quantity: transaction.quantity,
    unit: transaction.unit,
    location_id: transaction.location_id,
    reason: transaction.reason,
    notes: transaction.notes,
    created_at: transaction.created_at,
    reversal_of: transaction.reversal_of,
  };
}

async function applyLotWrite(
  txn: SqlDatabase,
  write: InventoryLotWrite,
  payload: Record<string, unknown>,
  nowMs: number,
): Promise<void> {
  if (write.kind === 'tombstone' || write.kind === 'restore') {
    const quantity = write.patch.quantity;
    if (typeof quantity !== 'number') throw new Error(`Lot ${write.item_id} hat keine Menge.`);
    // Quantity and deleted_at form one SQLite CHECK invariant. The generic
    // mirror helper cannot update both columns in one statement yet.
    await txn.runAsync(
      'update fridge_items set quantity = ?, deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
      [quantity, write.kind === 'tombstone' ? nowMs : null, nowMs, write.item_id],
    );
    return;
  }

  await applyLocalMirrorWrite(
    txn,
    'fridge_items',
    write.kind === 'create' ? 'insert' : 'update',
    payload,
    nowMs,
  );
}

async function buildInputs(
  operation: InventoryOperationV1,
  footprint: InventoryOperationFootprint,
  lotWrites: readonly InventoryLotWrite[],
  ledgerWrites: readonly InventoryLedgerWrite[],
  nowMs: number,
  authenticatedActorId: string,
): Promise<readonly EnqueueMutationInput[]> {
  const inputs: EnqueueMutationInput[] = [];
  for (const write of lotWrites) {
    const payload = envelopePayload(lotPayload(write), operation, authenticatedActorId, footprint);
    inputs.push({
      entity: 'fridge_items',
      entityId: write.item_id,
      op: lotOutboxOp(write.kind),
      payload,
      now: nowMs,
      applyLocally: (innerTxn) => applyLotWrite(innerTxn, write, payload, nowMs),
    });
  }
  for (const write of ledgerWrites) {
    const payload = envelopePayload(
      ledgerPayload(write),
      operation,
      authenticatedActorId,
      footprint,
    );
    inputs.push({
      entity: 'transactions',
      entityId: write.transaction.id,
      op: 'insert',
      payload,
      now: nowMs,
      applyLocally: (innerTxn) =>
        applyLocalMirrorWrite(innerTxn, 'transactions', 'insert', payload, nowMs),
    });
  }
  return inputs;
}

export async function commitInventoryOperation(
  db: SqlDatabase,
  operation: InventoryOperationV1,
  authenticatedActorId: string,
): Promise<InventoryCommitResult> {
  const nowMs = Date.parse(operation.created_at);
  if (!Number.isFinite(nowMs)) throw new Error('Operation created_at ist ungueltig.');

  let result: InventoryCommitResult | undefined;
  await enqueueMutationsInExclusiveTransaction(db, async (txn) => {
    const requestedFootprint = computeInventoryOperationFootprint(operation);
    const entityIds = unique([
      ...requestedFootprint.lots.read,
      ...requestedFootprint.lots.created,
      ...requestedFootprint.lots.updated,
      ...requestedFootprint.lots.restored,
      ...requestedFootprint.lots.tombstoned,
      ...requestedFootprint.ledger.read,
      ...requestedFootprint.ledger.created,
      ...requestedFootprint.ledger.reversed,
    ]);
    const envelopes = await loadRelevantEnvelopes(txn, operation.operation_id, entityIds);
    const existing = envelopes.find((entry) => entry.operation_id === operation.operation_id);
    if (existing) {
      result =
        existing.actor_id === authenticatedActorId &&
        areInventoryOperationRequestsEqual(existing.request, operation)
          ? {
              kind: 'replayed',
              operation_id: operation.operation_id,
              footprint: existing.footprint,
            }
          : {
              kind: 'conflict',
              operation_id: operation.operation_id,
              code: 'ID_PAYLOAD_MISMATCH',
            };
      return [];
    }

    const lotIds = unique([
      ...requestedFootprint.lots.read,
      ...requestedFootprint.lots.created,
      ...requestedFootprint.lots.updated,
      ...requestedFootprint.lots.restored,
      ...requestedFootprint.lots.tombstoned,
    ]);
    const ledgerIds = unique([
      ...requestedFootprint.ledger.read,
      ...requestedFootprint.ledger.created,
      ...requestedFootprint.ledger.reversed,
    ]);
    const state: InventoryPlanningState = {
      lots: await loadLots(txn, lotIds),
      transactions: await loadTransactions(txn, operation.household_id, lotIds, ledgerIds),
      authenticated_actor_id: authenticatedActorId,
      now: operation.created_at,
    };
    const plan = planInventoryOperation(operation, state);
    if (plan.kind === 'conflict') {
      result = { kind: 'conflict', operation_id: operation.operation_id, code: plan.code };
      return [];
    }

    const inputs = await buildInputs(
      operation,
      plan.footprint,
      plan.lot_writes,
      plan.ledger_writes,
      nowMs,
      authenticatedActorId,
    );
    result = {
      kind: 'applied',
      operation_id: operation.operation_id,
      footprint: plan.footprint,
      outbox_count: inputs.length,
    };
    return inputs;
  });

  if (!result) throw new Error('Inventory-Commit lieferte kein Ergebnis.');
  return result;
}
