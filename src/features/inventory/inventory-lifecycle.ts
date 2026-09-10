import {
  type InventoryOperationV1,
  type InventorySnapshotV1,
  inventoryOperationSchema,
} from '@/lib/db/zod/inventory-lifecycle.zod';
import { subtractInventoryQuantities } from '@/lib/inventory-quantity';

export type {
  InventoryOperationV1,
  InventorySnapshotV1,
} from '@/lib/db/zod/inventory-lifecycle.zod';
export {
  ALL_CANONICAL_OPERATION_TYPES,
  CANONICAL_CONTRACT_VERSION,
} from '@/lib/db/zod/inventory-lifecycle.zod';

type ValidationIssue = { path: readonly PropertyKey[]; message: string };
export class InventoryValidationError extends Error {
  readonly code = 'PAYLOAD_VALIDATION_FAILED' as const;

  constructor(
    message: string,
    readonly issues: readonly ValidationIssue[] = [],
  ) {
    super(message);
    this.name = 'InventoryValidationError';
  }
}
function copyOwnProperties(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value)) throw new Error('Cyclic operation payloads are not allowed.');
  seen.add(value);

  if (Array.isArray(value)) {
    const copy = value.map((entry) => copyOwnProperties(entry, seen));
    seen.delete(value);
    return copy;
  }

  if (Object.getOwnPropertySymbols(value).length > 0)
    throw new Error('Unknown symbol properties are not allowed.');

  const copy: Record<string, unknown> = Object.create(null);
  for (const key of Object.getOwnPropertyNames(value)) {
    if (key === '__proto__') throw new Error("Unknown or forbidden property '__proto__'.");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || descriptor.value === undefined)
      throw new Error(`Explicit undefined is not allowed at ${key}.`);
    copy[key] = copyOwnProperties(descriptor.value, seen);
  }
  seen.delete(value);
  return copy;
}

export function validateInventoryOperation(
  value: unknown,
):
  | { success: true; data: InventoryOperationV1 }
  | { success: false; error: InventoryValidationError } {
  try {
    const result = inventoryOperationSchema.safeParse(copyOwnProperties(value));
    if (result.success) return result;
    return {
      success: false,
      error: new InventoryValidationError(result.error.message, result.error.issues),
    };
  } catch (error) {
    return {
      success: false,
      error: new InventoryValidationError(
        error instanceof Error ? error.message : 'Invalid operation payload.',
      ),
    };
  }
}

export function assertValidInventoryOperation(value: unknown): InventoryOperationV1 {
  const result = validateInventoryOperation(value);
  if (!result.success) throw result.error;
  return result.data;
}

export type InventoryIntentLot = {
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
  vacuum_sealed: boolean;
  expiry_user_set: boolean;
  added_by: string | null;
};

type OperationIdentity = {
  operation_id: string;
  created_at: string;
};

export function createInsertInventoryOperation(
  input: OperationIdentity & {
    item_id: string;
    in_transaction_id: string;
    household_id: string;
    quantity: number;
    product_id: string | null;
    name: string;
    unit: string;
    package_size: number | null;
    package_size_unit: string | null;
    location_id: string;
    expiry_date: string | null;
    vacuum_sealed?: boolean;
    expiry_user_set?: boolean;
  },
): InventoryOperationV1 {
  return assertValidInventoryOperation({
    contract_version: 1,
    type: 'insert_inventory',
    ...input,
    opened_at: null,
    vacuum_sealed: input.vacuum_sealed ?? false,
    expiry_user_set: input.expiry_user_set ?? false,
  });
}

export function createConsumeInventoryOperation(
  input: OperationIdentity & {
    out_transaction_id: string;
    source: InventoryIntentLot;
    consumed_quantity: number;
    opened_item_id: string;
    opened_expiry_date: string | null;
    recipe_id?: string | null;
    recipe_name?: string | null;
    meal_plan_entry_id?: string | null;
  },
): InventoryOperationV1 {
  const { source, opened_item_id: openedItemId, opened_expiry_date: openedExpiryDate } = input;
  const portionQuantity = source.package_size ?? source.quantity;
  const sealedPartial =
    source.opened_at === null &&
    source.package_size !== null &&
    input.consumed_quantity < portionQuantity &&
    portionQuantity <= source.quantity;
  const mode =
    source.opened_at !== null ? 'opened' : sealedPartial ? 'sealed_partial' : 'sealed_full';
  const operation = {
    contract_version: 1 as const,
    type: 'consume_inventory' as const,
    operation_id: input.operation_id,
    out_transaction_id: input.out_transaction_id,
    source_item_id: source.id,
    household_id: source.household_id,
    created_at: input.created_at,
    expected_quantity: source.quantity,
    consumed_quantity: input.consumed_quantity,
    product_id: source.product_id,
    unit: source.unit,
    location_id: source.location_id,
    mode,
    ...(input.recipe_id !== undefined ? { recipe_id: input.recipe_id } : {}),
    ...(input.recipe_name !== undefined ? { recipe_name: input.recipe_name } : {}),
    ...(input.meal_plan_entry_id !== undefined
      ? { meal_plan_entry_id: input.meal_plan_entry_id }
      : {}),
    ...(sealedPartial
      ? {
          opened_item_id: openedItemId,
          portion_quantity: portionQuantity,
          remainder_quantity: subtractInventoryQuantities(portionQuantity, input.consumed_quantity),
          opened_at: input.created_at,
          expiry_date: openedExpiryDate,
          vacuum_sealed: false,
          expiry_user_set: source.expiry_user_set,
          merge_snapshot: {
            household_id: source.household_id,
            product_id: source.product_id,
            name: source.name,
            unit: source.unit,
            package_size: source.package_size,
            package_size_unit: source.package_size_unit,
            location_id: source.location_id,
            expiry_date: source.expiry_date,
            opened_at: source.opened_at,
            vacuum_sealed: source.vacuum_sealed,
            expiry_user_set: source.expiry_user_set,
            added_by: source.added_by,
            quantity_before: source.quantity,
          },
        }
      : {}),
  };
  return assertValidInventoryOperation(operation);
}

export function createWasteInventoryOperation(
  input: OperationIdentity & {
    waste_transaction_id: string;
    source: InventoryIntentLot;
    reason: 'expired' | 'spoiled' | 'other';
  },
): InventoryOperationV1 {
  return assertValidInventoryOperation({
    contract_version: 1,
    type: 'waste_inventory',
    operation_id: input.operation_id,
    waste_transaction_id: input.waste_transaction_id,
    item_id: input.source.id,
    household_id: input.source.household_id,
    created_at: input.created_at,
    expected_quantity: input.source.quantity,
    waste_quantity: input.source.quantity,
    reason: input.reason,
    product_id: input.source.product_id,
    unit: input.source.unit,
    location_id: input.source.location_id,
  });
}

export function createMoveInventoryOperation(
  input: OperationIdentity & {
    out_transaction_id: string;
    in_transaction_id: string;
    source: InventoryIntentLot;
    to_location_id: string;
  },
): InventoryOperationV1 {
  return assertValidInventoryOperation({
    contract_version: 1,
    type: 'move_inventory',
    operation_id: input.operation_id,
    out_transaction_id: input.out_transaction_id,
    in_transaction_id: input.in_transaction_id,
    item_id: input.source.id,
    household_id: input.source.household_id,
    created_at: input.created_at,
    expected_quantity: input.source.quantity,
    expected_location_id: input.source.location_id,
    to_location_id: input.to_location_id,
    product_id: input.source.product_id,
    unit: input.source.unit,
    location_id: input.source.location_id,
  });
}

export function createCorrectQuantityOperation(
  input: OperationIdentity & {
    transaction_id: string;
    source: InventoryIntentLot;
    new_quantity: number;
  },
): InventoryOperationV1 {
  return assertValidInventoryOperation({
    contract_version: 1,
    type: 'correct_quantity',
    operation_id: input.operation_id,
    transaction_id: input.transaction_id,
    item_id: input.source.id,
    household_id: input.source.household_id,
    created_at: input.created_at,
    expected_quantity: input.source.quantity,
    new_quantity: input.new_quantity,
    product_id: input.source.product_id,
    unit: input.source.unit,
    location_id: input.source.location_id,
  });
}

type LotCore = Omit<InventorySnapshotV1, 'quantity_before'>;
const snapshotLot = ({ quantity_before: _quantityBefore, ...lot }: InventorySnapshotV1): LotCore =>
  lot;

export type InventoryLotState = LotCore & {
  id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
export type InventoryTransactionType = 'in' | 'out' | 'waste';
export type InventoryTransactionState = {
  id: string;
  operation_id: string;
  reversal_of: string | null;
  household_id: string;
  fridge_item_id: string;
  product_id: string | null;
  actor: string | null;
  type: InventoryTransactionType;
  quantity: number;
  unit: string;
  location_id: string;
  reason: 'expired' | 'spoiled' | 'other' | null;
  notes: string | null;
  created_at: string;
};
export type InventoryPlanningState = {
  lots: readonly InventoryLotState[];
  transactions: readonly InventoryTransactionState[];
  authenticated_actor_id: string | null;
  now: string;
};
export type InventoryLotWrite = {
  kind: 'create' | 'update' | 'tombstone' | 'restore';
  item_id: string;
  expected_quantity: number | null;
  expected_updated_at?: string;
  expected_location_id?: string;
  patch: Partial<InventoryLotState>;
};
export type InventoryLedgerWrite = { kind: 'create'; transaction: InventoryTransactionState };
export type InventoryOperationFootprint = {
  lots: {
    read: string[];
    created: string[];
    updated: string[];
    restored: string[];
    tombstoned: string[];
  };
  ledger: { read: string[]; created: string[]; reversed: string[] };
};
export type InventoryConflictCode = 'STALE_BASE' | 'INSUFFICIENT_QUANTITY' | 'ID_PAYLOAD_MISMATCH';
export type InventoryOperationPlan =
  | {
      kind: 'planned';
      footprint: InventoryOperationFootprint;
      lot_writes: InventoryLotWrite[];
      ledger_writes: InventoryLedgerWrite[];
    }
  | { kind: 'conflict'; code: InventoryConflictCode };

type LotParts = InventoryOperationFootprint['lots'];
type LedgerParts = InventoryOperationFootprint['ledger'];
const unique = (values: readonly string[]) => [...new Set(values)];
const makeFootprint = (
  lots: Partial<LotParts> = {},
  ledger: Partial<LedgerParts> = {},
): InventoryOperationFootprint => ({
  lots: {
    read: unique(lots.read ?? []),
    created: unique(lots.created ?? []),
    updated: unique(lots.updated ?? []),
    restored: unique(lots.restored ?? []),
    tombstoned: unique(lots.tombstoned ?? []),
  },
  ledger: {
    read: unique(ledger.read ?? []),
    created: unique(ledger.created ?? []),
    reversed: unique(ledger.reversed ?? []),
  },
});

export function computeInventoryOperationFootprint(
  value: InventoryOperationV1,
  lotWrites?: readonly InventoryLotWrite[],
  ledgerWrites?: readonly InventoryLedgerWrite[],
): InventoryOperationFootprint {
  const lots: LotParts = { read: [], created: [], updated: [], restored: [], tombstoned: [] };
  const ledger: LedgerParts = { read: [], created: [], reversed: [] };

  if (value.type === 'insert_inventory') {
    lots.created.push(value.item_id);
    ledger.created.push(value.in_transaction_id);
  } else if (value.type === 'consume_inventory') {
    lots.read.push(value.source_item_id);
    ledger.created.push(value.out_transaction_id);
    lots.updated.push(value.source_item_id);
    if (value.mode === 'sealed_partial') {
      lots.created.push(value.opened_item_id);
      if (value.portion_quantity === value.expected_quantity)
        lots.tombstoned.push(value.source_item_id);
    } else if (value.consumed_quantity === value.expected_quantity) {
      lots.tombstoned.push(value.source_item_id);
    }
  } else if (value.type === 'waste_inventory') {
    lots.read.push(value.item_id);
    lots.updated.push(value.item_id);
    ledger.created.push(value.waste_transaction_id);
    if (value.waste_quantity === value.expected_quantity) lots.tombstoned.push(value.item_id);
  } else if (value.type === 'move_inventory') {
    lots.read.push(value.item_id);
    lots.updated.push(value.item_id);
    ledger.created.push(value.out_transaction_id, value.in_transaction_id);
  } else {
    lots.read.push(value.item_id);
    lots.updated.push(value.item_id);
    ledger.created.push(value.transaction_id);
    if (value.new_quantity === 0) lots.tombstoned.push(value.item_id);
  }

  if (lotWrites !== undefined && ledgerWrites !== undefined) {
    lots.created = [];
    lots.updated = [];
    lots.restored = [];
    lots.tombstoned = [];
    ledger.created = [];
    for (const write of lotWrites) {
      if (write.kind === 'create') lots.created.push(write.item_id);
      else lots.updated.push(write.item_id);
      if (write.kind === 'restore') lots.restored.push(write.item_id);
      if (write.kind === 'tombstone') lots.tombstoned.push(write.item_id);
    }
    for (const write of ledgerWrites) ledger.created.push(write.transaction.id);
  }

  return makeFootprint(lots, ledger);
}

const conflict = (code: InventoryConflictCode): InventoryOperationPlan => ({
  kind: 'conflict',
  code,
});
const lotOf = (state: InventoryPlanningState, id: string, householdId: string) =>
  state.lots.find((lot) => lot.id === id && lot.household_id === householdId);
const activeLot = (state: InventoryPlanningState, id: string, householdId: string) => {
  const lot = lotOf(state, id, householdId);
  return lot?.deleted_at === null ? lot : undefined;
};
const idsAvailable = (
  state: InventoryPlanningState,
  lotIds: readonly string[],
  ledgerIds: readonly string[],
) =>
  !lotIds.some((id) => state.lots.some((lot) => lot.id === id)) &&
  !ledgerIds.some((id) => state.transactions.some((transaction) => transaction.id === id));
const intentMatches = (
  lot: InventoryLotState,
  value: { product_id: string | null; unit: string; location_id: string },
) =>
  lot.product_id === value.product_id &&
  lot.unit === value.unit &&
  lot.location_id === value.location_id;
const sameSnapshot = (lot: InventoryLotState, snapshot: InventorySnapshotV1) =>
  lot.household_id === snapshot.household_id &&
  lot.product_id === snapshot.product_id &&
  lot.name === snapshot.name &&
  lot.unit === snapshot.unit &&
  lot.package_size === snapshot.package_size &&
  lot.package_size_unit === snapshot.package_size_unit &&
  lot.location_id === snapshot.location_id &&
  lot.expiry_date === snapshot.expiry_date &&
  lot.opened_at === snapshot.opened_at &&
  lot.vacuum_sealed === snapshot.vacuum_sealed &&
  lot.expiry_user_set === snapshot.expiry_user_set &&
  lot.added_by === snapshot.added_by;

const writeLot = (
  lot: InventoryLotState,
  operation: InventoryOperationV1,
  nextQuantity: number,
  patch: Partial<InventoryLotState> = {},
): InventoryLotWrite => ({
  kind: nextQuantity === 0 ? 'tombstone' : lot.deleted_at === null ? 'update' : 'restore',
  item_id: lot.id,
  expected_quantity: lot.quantity,
  expected_updated_at: lot.updated_at,
  patch: {
    quantity: nextQuantity,
    updated_at: operation.created_at,
    deleted_at: nextQuantity === 0 ? operation.created_at : null,
    ...patch,
  },
});
const createLot = (
  operation: InventoryOperationV1,
  itemId: string,
  values: LotCore & { quantity: number },
): InventoryLotWrite => ({
  kind: 'create',
  item_id: itemId,
  expected_quantity: null,
  patch: {
    id: itemId,
    ...values,
    created_at: operation.created_at,
    updated_at: operation.created_at,
    deleted_at: null,
  },
});

type LedgerOperation = Extract<
  InventoryOperationV1,
  {
    type:
      | 'insert_inventory'
      | 'consume_inventory'
      | 'waste_inventory'
      | 'move_inventory'
      | 'correct_quantity';
  }
>;
type TransactionPatch = Partial<Pick<InventoryTransactionState, 'reason' | 'notes'>>;
const transaction = (
  operation: LedgerOperation,
  id: string,
  type: InventoryTransactionType,
  amount: number,
  itemId: string,
  locationId: string,
  actor: string,
  patch: TransactionPatch = {},
): InventoryLedgerWrite => ({
  kind: 'create',
  transaction: {
    id,
    operation_id: operation.operation_id,
    reversal_of: null,
    household_id: operation.household_id,
    fridge_item_id: itemId,
    product_id: operation.product_id,
    actor,
    type,
    quantity: amount,
    unit: operation.unit,
    location_id: locationId,
    reason: null,
    notes: null,
    created_at: operation.created_at,
    ...patch,
  },
});
const planned = (
  operation: InventoryOperationV1,
  lotWrites: InventoryLotWrite[],
  ledgerWrites: InventoryLedgerWrite[],
): InventoryOperationPlan => ({
  kind: 'planned',
  footprint: computeInventoryOperationFootprint(operation, lotWrites, ledgerWrites),
  lot_writes: lotWrites,
  ledger_writes: ledgerWrites,
});

function planInsert(
  operation: Extract<InventoryOperationV1, { type: 'insert_inventory' }>,
  state: InventoryPlanningState,
): InventoryOperationPlan {
  const actor = state.authenticated_actor_id;
  if (!actor || !idsAvailable(state, [operation.item_id], [operation.in_transaction_id]))
    return conflict('STALE_BASE');

  const lot = createLot(operation, operation.item_id, {
    household_id: operation.household_id,
    product_id: operation.product_id,
    name: operation.name,
    unit: operation.unit,
    package_size: operation.package_size,
    package_size_unit: operation.package_size_unit,
    location_id: operation.location_id,
    expiry_date: operation.expiry_date,
    opened_at: operation.opened_at,
    vacuum_sealed: operation.vacuum_sealed,
    expiry_user_set: operation.expiry_user_set,
    added_by: actor,
    quantity: operation.quantity,
  });
  return planned(
    operation,
    [lot],
    [
      transaction(
        operation,
        operation.in_transaction_id,
        'in',
        operation.quantity,
        operation.item_id,
        operation.location_id,
        actor,
      ),
    ],
  );
}

function planConsume(
  operation: Extract<InventoryOperationV1, { type: 'consume_inventory' }>,
  state: InventoryPlanningState,
): InventoryOperationPlan {
  const actor = state.authenticated_actor_id;
  const lot = activeLot(state, operation.source_item_id, operation.household_id);
  if (!actor || !lot || !intentMatches(lot, operation)) return conflict('STALE_BASE');
  if (operation.consumed_quantity > lot.quantity) return conflict('INSUFFICIENT_QUANTITY');
  if (lot.quantity !== operation.expected_quantity) return conflict('STALE_BASE');
  if (operation.mode === 'sealed_full' && lot.opened_at !== null) return conflict('STALE_BASE');
  if (operation.mode === 'opened' && lot.opened_at === null) return conflict('STALE_BASE');
  if (
    operation.mode === 'sealed_partial' &&
    (lot.opened_at !== null ||
      !sameSnapshot(lot, operation.merge_snapshot) ||
      operation.merge_snapshot.quantity_before !== operation.expected_quantity)
  )
    return conflict('STALE_BASE');

  const openedId = operation.mode === 'sealed_partial' ? operation.opened_item_id : undefined;
  if (!idsAvailable(state, openedId ? [openedId] : [], [operation.out_transaction_id]))
    return conflict('STALE_BASE');

  const sourceQuantity =
    operation.mode === 'sealed_partial'
      ? subtractInventoryQuantities(lot.quantity, operation.portion_quantity)
      : subtractInventoryQuantities(lot.quantity, operation.consumed_quantity);
  const lotWrites: InventoryLotWrite[] = [writeLot(lot, operation, sourceQuantity)];
  if (operation.mode === 'sealed_partial') {
    lotWrites.push(
      createLot(operation, operation.opened_item_id, {
        ...snapshotLot(operation.merge_snapshot),
        quantity: operation.remainder_quantity,
        opened_at: operation.opened_at,
        expiry_date: operation.expiry_date,
        vacuum_sealed: operation.vacuum_sealed,
        expiry_user_set: operation.expiry_user_set,
      }),
    );
  }
  return planned(operation, lotWrites, [
    transaction(
      operation,
      operation.out_transaction_id,
      'out',
      operation.consumed_quantity,
      operation.mode === 'sealed_partial' ? operation.opened_item_id : operation.source_item_id,
      operation.location_id,
      actor,
    ),
  ]);
}

function planWaste(
  operation: Extract<InventoryOperationV1, { type: 'waste_inventory' }>,
  state: InventoryPlanningState,
): InventoryOperationPlan {
  const actor = state.authenticated_actor_id;
  const lot = activeLot(state, operation.item_id, operation.household_id);
  if (!actor || !lot || !intentMatches(lot, operation)) return conflict('STALE_BASE');
  if (operation.waste_quantity > lot.quantity) return conflict('INSUFFICIENT_QUANTITY');
  if (lot.quantity !== operation.expected_quantity) return conflict('STALE_BASE');
  if (!idsAvailable(state, [], [operation.waste_transaction_id])) return conflict('STALE_BASE');
  const nextQuantity = subtractInventoryQuantities(lot.quantity, operation.waste_quantity);
  return planned(
    operation,
    [writeLot(lot, operation, nextQuantity)],
    [
      transaction(
        operation,
        operation.waste_transaction_id,
        'waste',
        operation.waste_quantity,
        operation.item_id,
        operation.location_id,
        actor,
        { reason: operation.reason },
      ),
    ],
  );
}

function planMove(
  operation: Extract<InventoryOperationV1, { type: 'move_inventory' }>,
  state: InventoryPlanningState,
): InventoryOperationPlan {
  const actor = state.authenticated_actor_id;
  const lot = activeLot(state, operation.item_id, operation.household_id);
  if (
    !actor ||
    !lot ||
    lot.quantity !== operation.expected_quantity ||
    lot.location_id !== operation.expected_location_id ||
    !intentMatches(lot, operation)
  )
    return conflict('STALE_BASE');
  if (!idsAvailable(state, [], [operation.out_transaction_id, operation.in_transaction_id]))
    return conflict('STALE_BASE');

  const movedLot = writeLot(lot, operation, lot.quantity, {
    location_id: operation.to_location_id,
  });
  return planned(
    operation,
    [movedLot],
    [
      transaction(
        operation,
        operation.out_transaction_id,
        'out',
        operation.expected_quantity,
        operation.item_id,
        operation.expected_location_id,
        actor,
      ),
      transaction(
        operation,
        operation.in_transaction_id,
        'in',
        operation.expected_quantity,
        operation.item_id,
        operation.to_location_id,
        actor,
      ),
    ],
  );
}

function planCorrection(
  operation: Extract<InventoryOperationV1, { type: 'correct_quantity' }>,
  state: InventoryPlanningState,
): InventoryOperationPlan {
  const actor = state.authenticated_actor_id;
  const lot = activeLot(state, operation.item_id, operation.household_id);
  if (!actor || !lot || !intentMatches(lot, operation)) return conflict('STALE_BASE');
  if (lot.quantity !== operation.expected_quantity) return conflict('STALE_BASE');
  if (!idsAvailable(state, [], [operation.transaction_id])) return conflict('STALE_BASE');

  const increased = operation.new_quantity > operation.expected_quantity;
  const delta = increased
    ? subtractInventoryQuantities(operation.new_quantity, operation.expected_quantity)
    : subtractInventoryQuantities(operation.expected_quantity, operation.new_quantity);
  return planned(
    operation,
    [writeLot(lot, operation, operation.new_quantity)],
    [
      transaction(
        operation,
        operation.transaction_id,
        increased ? 'in' : 'out',
        delta,
        operation.item_id,
        operation.location_id,
        actor,
        { notes: '[Manual correction]' },
      ),
    ],
  );
}

const canonicalPayload = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalPayload);
  if (typeof value !== 'object' || value === null) return value;
  const sorted: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(value).sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && 'value' in descriptor) sorted[key] = canonicalPayload(descriptor.value);
  }
  return sorted;
};

export function areInventoryOperationRequestsEqual(
  left: InventoryOperationV1,
  right: InventoryOperationV1,
): boolean {
  return (
    JSON.stringify(canonicalPayload(copyOwnProperties(left))) ===
    JSON.stringify(canonicalPayload(copyOwnProperties(right)))
  );
}

export function planInventoryOperation(
  value: InventoryOperationV1,
  state: InventoryPlanningState,
): InventoryOperationPlan {
  if (value.type === 'insert_inventory') return planInsert(value, state);
  if (value.type === 'consume_inventory') return planConsume(value, state);
  if (value.type === 'waste_inventory') return planWaste(value, state);
  if (value.type === 'move_inventory') return planMove(value, state);
  return planCorrection(value, state);
}
