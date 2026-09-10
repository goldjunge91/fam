import {
  fromInventoryQuantityUnits,
  INVENTORY_QUANTITY_SCALE,
  isNonNegativeIntegerThousandths,
  isPositiveIntegerThousandths,
  toInventoryQuantityUnits,
} from '@/lib/inventory-quantity';
import { calculateOpenedExpiryDate } from './opened-expiry';

export type InventoryTransactionType = 'in' | 'out' | 'waste' | 'open';

export type LifecycleItem = {
  id: string;
  householdId: string;
  locationId: string | null;
  productId: string | null;
  name: string;
  quantity: number;
  unit: string;
  expiryDate: string | null;
  openedAt: string | null;
  vacuumSealed: boolean;
  expiryUserSet: boolean;
  packageSize: number | null;
  packageSizeUnit: string | null;
  addedBy: string | null;
  category?: string | null;
  locationKind?: string | null;
  createdAt?: string | null;
  updatedAt?: string | number | null;
};

export type OpenInventoryPlan = {
  originalPatch: Partial<LifecycleItem>;
  openedItem: LifecycleItem | null;
};

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

export type InventoryUndoMode = 'undo' | 'manual-correction';

export function inventoryUndoMode(createdAt: string | Date, now: Date): InventoryUndoMode {
  const createdAtDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(createdAtDate.getTime()))
    throw new Error('Die Buchung hat kein gültiges Datum.');
  if (createdAtDate.getTime() > now.getTime()) {
    throw new Error('Buchungen aus der Zukunft können nicht rückgängig gemacht werden.');
  }
  return canUndoTransaction(createdAtDate, now) ? 'undo' : 'manual-correction';
}

export function undoTransactionNotes(
  mode: InventoryUndoMode,
  _type?: InventoryTransactionType,
): string {
  if (mode === 'manual-correction') return '[Manual correction]';
  return '[Undone] Gegenbuchung';
}

function toIsoTimestamp(value: Date): string {
  return value.toISOString();
}

function assertValidOpenQuantity(
  item: LifecycleItem,
  quantity: number,
): { itemUnits: number; quantityUnits: number } {
  const itemUnits = toInventoryQuantityUnits(item.quantity);
  const quantityUnits = toInventoryQuantityUnits(quantity);
  if (quantityUnits <= 0 || quantityUnits > itemUnits) {
    throw new Error(
      'Die Öffnungsmenge muss größer als 0 und höchstens der Bestandsmenge entsprechen.',
    );
  }
  return { itemUnits, quantityUnits };
}

/** Erstellt alle lokalen Änderungen für eine Öffnung, ohne Datenbankzugriff. */
export function planOpenInventoryItem(
  item: LifecycleItem,
  quantity: number,
  openedAt: Date,
  openedItemId: string,
): OpenInventoryPlan {
  const { itemUnits, quantityUnits } = assertValidOpenQuantity(item, quantity);
  if (item.openedAt !== null) {
    throw new Error('Ein bereits geöffnetes Los kann nicht erneut geöffnet werden.');
  }

  const openedAtIso = toIsoTimestamp(openedAt);
  const expiryDate = calculateOpenedExpiryDate({
    name: item.name,
    category: item.category,
    locationKind: item.locationKind,
    openedAt,
    currentExpiryDate: item.expiryDate,
    expiryUserSet: item.expiryUserSet,
    vacuumSealed: item.vacuumSealed,
  });
  const isSingleUnit = itemUnits === INVENTORY_QUANTITY_SCALE;
  const expiryUserSet = item.expiryUserSet && expiryDate === item.expiryDate;

  if (isSingleUnit) {
    return {
      originalPatch: {
        openedAt: openedAtIso,
        expiryDate,
        expiryUserSet,
        vacuumSealed: item.vacuumSealed,
      },
      openedItem: null,
    };
  }

  const openedItem: LifecycleItem = {
    ...item,
    id: openedItemId,
    quantity,
    openedAt: openedAtIso,
    expiryDate,
  };

  return {
    originalPatch: { quantity: fromInventoryQuantityUnits(itemUnits - quantityUnits) },
    openedItem,
  };
}

export function canUndoTransaction(createdAt: Date, now: Date): boolean {
  const age = now.getTime() - createdAt.getTime();
  return age >= 0 && age <= UNDO_WINDOW_MS;
}

export function inverseTransactionType(type: InventoryTransactionType): InventoryTransactionType {
  if (type === 'in') return 'out';
  return 'in';
}

// --- v1-Operationsvertrag (contract.md) ---

export const CANONICAL_CONTRACT_VERSION = 1;

export const ALL_CANONICAL_OPERATION_TYPES = [
  'insert_inventory',
  'open_inventory',
  'consume_inventory',
  'waste_inventory',
  'move_inventory',
  'correct_quantity',
  'undo_inventory_operation',
  'reseal_inventory',
  'patch_inventory_metadata',
] as const;

export type CanonicalInventoryOperationType = (typeof ALL_CANONICAL_OPERATION_TYPES)[number];

/** Felder, die jede v1-Operation trägt (contract.md Abschnitt 2 und 4). */
type BaseInventoryOperationV1 = {
  contract_version: 1;
  operation_id: string;
  household_id: string;
  created_at: string;
};

export type InsertInventoryOperationV1 = BaseInventoryOperationV1 & {
  type: 'insert_inventory';
  item_id: string;
  in_transaction_id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit: string;
  location_id: string;
  expiry_date?: string | null;
  opened_at?: string | null;
};

/** Reines Öffnen ohne Verbrauch (contract.md Abschnitt 5.1). */
export type OpenInventoryOperationV1 = BaseInventoryOperationV1 & {
  type: 'open_inventory';
  source_item_id: string;
  /** CAS-Anker: erwartete Menge des Quelllos vor dem Öffnen. */
  expected_quantity: number;
  /** Öffnungsanteil P. */
  portion_quantity: number;
  opened_at: string;
  /** Nur gesetzt, wenn source_before > P und die Quelle atomar gesplittet wird. */
  opened_item_id?: string;
};

type ConsumeInventoryBaseV1 = BaseInventoryOperationV1 & {
  type: 'consume_inventory';
  out_transaction_id: string;
  source_item_id: string;
  /** CAS-Anker: erwartete Menge des Quelllos vor dem Verbrauch. */
  expected_quantity: number;
  /** Tatsächlich verbrauchte Menge C. */
  consumed_quantity: number;
  consumed_at: string;
  recipe_id?: string | null;
  recipe_name?: string | null;
  meal_plan_entry_id?: string | null;
};

export type ConsumeSealedFullOperationV1 = ConsumeInventoryBaseV1 & { mode: 'sealed_full' };
export type ConsumeOpenedOperationV1 = ConsumeInventoryBaseV1 & { mode: 'opened' };
export type ConsumeSealedPartialOperationV1 = ConsumeInventoryBaseV1 & {
  mode: 'sealed_partial';
  opened_item_id: string;
  /** Angebrochene Packungsmenge P; C < P ist Vertragsvoraussetzung. */
  portion_quantity: number;
  opened_at: string;
  merge_snapshot: MergeSnapshotV1;
};

export type ConsumeInventoryOperationV1 =
  | ConsumeSealedFullOperationV1
  | ConsumeOpenedOperationV1
  | ConsumeSealedPartialOperationV1;

export type WasteInventoryOperationV1 = BaseInventoryOperationV1 & {
  type: 'waste_inventory';
  waste_transaction_id: string;
  item_id: string;
  expected_quantity: number;
  waste_quantity: number;
  reason: 'expired' | 'spoiled' | 'other';
};

export type MoveInventoryOperationV1 = BaseInventoryOperationV1 & {
  type: 'move_inventory';
  out_transaction_id: string;
  in_transaction_id: string;
  item_id: string;
  expected_quantity: number;
  expected_location_id: string;
  to_location_id: string;
};

export type CorrectQuantityOperationV1 = BaseInventoryOperationV1 & {
  type: 'correct_quantity';
  transaction_id: string;
  item_id: string;
  expected_quantity: number;
  new_quantity: number;
};

/** `reverse_quantity`: reguläres Mengen-Undo auf demselben Los (contract.md Abschnitt 6). */
export type UndoReverseQuantityOperationV1 = BaseInventoryOperationV1 & {
  type: 'undo_inventory_operation';
  mode: 'reverse_quantity';
  reversal_transaction_id: string;
  reversal_of: string;
  item_id: string;
  /** Unveraendert in die Gegenbuchung uebernommen, z.B. '[Undone] Gegenbuchung'. */
  notes?: string | null;
};

/** `reverse_move`: zwei gemeinsam committende Gegenbeine. */
export type UndoReverseMoveOperationV1 = BaseInventoryOperationV1 & {
  type: 'undo_inventory_operation';
  mode: 'reverse_move';
  reversal_out_transaction_id: string;
  reversal_in_transaction_id: string;
  reversal_of: string;
  item_id: string;
  notes?: string | null;
};

/** `merge_undo_open`: Undo des ersten Teilverbrauchs, reaktiviert Quelle und tombstoned den Rest. */
export type UndoMergeUndoOpenOperationV1 = BaseInventoryOperationV1 & {
  type: 'undo_inventory_operation';
  mode: 'merge_undo_open';
  in_transaction_id: string;
  reversal_of: string;
  source_item_id: string;
  opened_item_id: string;
  notes?: string | null;
};

export type UndoInventoryOperationV1 =
  | UndoReverseQuantityOperationV1
  | UndoReverseMoveOperationV1
  | UndoMergeUndoOpenOperationV1;

export type ResealInventoryOperationV1 = BaseInventoryOperationV1 & {
  type: 'reseal_inventory';
  item_id: string;
};

export type PatchInventoryMetadataOperationV1 = BaseInventoryOperationV1 & {
  type: 'patch_inventory_metadata';
  item_id: string;
  expected_updated_at: string;
  product_name?: string;
  notes?: string | null;
  expiry_date?: string | null;
};

export type InventoryOperationV1 =
  | InsertInventoryOperationV1
  | OpenInventoryOperationV1
  | ConsumeInventoryOperationV1
  | WasteInventoryOperationV1
  | MoveInventoryOperationV1
  | CorrectQuantityOperationV1
  | UndoInventoryOperationV1
  | ResealInventoryOperationV1
  | PatchInventoryMetadataOperationV1;

export type MergeSnapshotV1 = {
  household_id: string;
  product_id: string | null;
  name: string;
  unit: string;
  package_size: number | null;
  package_size_unit: string | null;
  location_id: string | null;
  expiry_date: string | null;
  opened_at: string | null;
  vacuum_sealed: boolean;
  expiry_user_set: boolean;
  added_by: string | null;
  quantity_before: number;
};

export type InventoryOperationFootprint = {
  lots: {
    created: string[];
    modified: string[];
    /** Zuvor tombstoned Lose, die diese Operation reaktiviert (contract.md Abschnitt 1: „restauriert"). */
    restored: string[];
    tombstoned: string[];
  };
  transactions: {
    created: string[];
    /** Ledger-IDs des Originals, auf das diese Operation per `reversal_of` verweist. */
    reversals: string[];
  };
};

export type ValidationSuccess<T> = {
  success: true;
  data: T;
};

export type ValidationError = {
  success: false;
  error: {
    code: 'PAYLOAD_VALIDATION_FAILED';
    message: string;
  };
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyStringProp(rawObj: Record<string, unknown>, key: string): boolean {
  return isNonEmptyString(rawObj[key]);
}

const BASE_ALLOWED_KEYS = [
  'contract_version',
  'type',
  'operation_id',
  'household_id',
  'created_at',
];

const OPERATION_ALLOWED_KEYS: Record<CanonicalInventoryOperationType, ReadonlySet<string>> = {
  insert_inventory: new Set([
    ...BASE_ALLOWED_KEYS,
    'item_id',
    'in_transaction_id',
    'product_id',
    'product_name',
    'quantity',
    'unit',
    'location_id',
    'expiry_date',
    'opened_at',
  ]),
  open_inventory: new Set([
    ...BASE_ALLOWED_KEYS,
    'source_item_id',
    'expected_quantity',
    'portion_quantity',
    'opened_at',
    'opened_item_id',
  ]),
  consume_inventory: new Set([
    ...BASE_ALLOWED_KEYS,
    'out_transaction_id',
    'source_item_id',
    'expected_quantity',
    'consumed_quantity',
    'consumed_at',
    'mode',
    'opened_item_id',
    'portion_quantity',
    'opened_at',
    'merge_snapshot',
    'recipe_id',
    'recipe_name',
    'meal_plan_entry_id',
  ]),
  waste_inventory: new Set([
    ...BASE_ALLOWED_KEYS,
    'waste_transaction_id',
    'item_id',
    'expected_quantity',
    'waste_quantity',
    'reason',
  ]),
  move_inventory: new Set([
    ...BASE_ALLOWED_KEYS,
    'out_transaction_id',
    'in_transaction_id',
    'item_id',
    'expected_quantity',
    'expected_location_id',
    'to_location_id',
  ]),
  correct_quantity: new Set([
    ...BASE_ALLOWED_KEYS,
    'transaction_id',
    'item_id',
    'expected_quantity',
    'new_quantity',
  ]),
  undo_inventory_operation: new Set([
    ...BASE_ALLOWED_KEYS,
    'mode',
    'reversal_transaction_id',
    'reversal_out_transaction_id',
    'reversal_in_transaction_id',
    'in_transaction_id',
    'reversal_of',
    'item_id',
    'source_item_id',
    'opened_item_id',
    'notes',
  ]),
  reseal_inventory: new Set([...BASE_ALLOWED_KEYS, 'item_id']),
  patch_inventory_metadata: new Set([
    ...BASE_ALLOWED_KEYS,
    'item_id',
    'expected_updated_at',
    'product_name',
    'notes',
    'expiry_date',
  ]),
};

function validationError(message: string): ValidationError {
  return {
    success: false,
    error: {
      code: 'PAYLOAD_VALIDATION_FAILED',
      message,
    },
  };
}

function validateMergeSnapshot(value: unknown): value is MergeSnapshotV1 {
  if (typeof value !== 'object' || value === null) return false;
  const snapshot = value as Record<string, unknown>;
  return (
    isNonEmptyString(snapshot.household_id) &&
    (snapshot.product_id === null || typeof snapshot.product_id === 'string') &&
    isNonEmptyString(snapshot.name) &&
    isNonEmptyString(snapshot.unit) &&
    (snapshot.package_size === null || isPositiveIntegerThousandths(snapshot.package_size)) &&
    (snapshot.package_size_unit === null || typeof snapshot.package_size_unit === 'string') &&
    (snapshot.location_id === null || typeof snapshot.location_id === 'string') &&
    (snapshot.expiry_date === null || typeof snapshot.expiry_date === 'string') &&
    (snapshot.opened_at === null || typeof snapshot.opened_at === 'string') &&
    typeof snapshot.vacuum_sealed === 'boolean' &&
    typeof snapshot.expiry_user_set === 'boolean' &&
    (snapshot.added_by === null || typeof snapshot.added_by === 'string') &&
    isNonNegativeIntegerThousandths(snapshot.quantity_before)
  );
}

export function validateInventoryOperation(raw: unknown): ValidationResult<InventoryOperationV1> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return validationError('Payload must be a non-null object');
  }

  // Kopie statt direktem Cast, UND prototyplos (Object.create(null)): ein
  // Payload mit einem eigenen Prototyp (z.B. per Object.create gesetzt)
  // koennte sonst "geerbte" Felder ueber jeden einfachen Property-Read
  // (`rawObj[key]`, `'key' in rawObj`) als scheinbar eigene Werte einschleusen.
  // Native Spread-Syntax (`{...raw}`) waere hier NICHT ausreichend: der
  // Babel-Transform dieses Projekts senkt Object-Spread auf einen Pfad ab,
  // der bei einem eigenen aufzaehlbaren `__proto__`-Schluessel (z.B. aus
  // JSON.parse) den [[Set]]-Pfad nimmt und damit den echten Prototyp des
  // Ziels veraendert, statt ihn als literalen Schluessel zu kopieren -
  // verifiziert per Test. Object.create(null) hat gar keinen Prototyp,
  // wodurch der `__proto__`-Setter (der auf Object.prototype liegt) beim
  // Kopieren nicht greifen kann; ein einfacher Zuweisungsloop bleibt sicher.
  const rawObj: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(raw as object)) {
    rawObj[key] = (raw as Record<string, unknown>)[key];
  }

  if (rawObj.contract_version !== CANONICAL_CONTRACT_VERSION) {
    return validationError(`Payload must specify contract_version: ${CANONICAL_CONTRACT_VERSION}`);
  }

  const opType = rawObj.type;
  if (
    typeof opType !== 'string' ||
    !ALL_CANONICAL_OPERATION_TYPES.includes(opType as CanonicalInventoryOperationType)
  ) {
    return validationError(`Invalid or missing operation type: '${String(opType)}'`);
  }

  const canonicalType = opType as CanonicalInventoryOperationType;
  const allowedKeys = OPERATION_ALLOWED_KEYS[canonicalType];

  for (const key of Object.keys(rawObj)) {
    if (!allowedKeys.has(key)) {
      return validationError(
        `Unknown or forbidden property '${key}' for operation '${canonicalType}'`,
      );
    }
  }

  if (!isNonEmptyStringProp(rawObj, 'operation_id')) {
    return validationError("Property 'operation_id' must be a non-empty string");
  }
  if (!isNonEmptyStringProp(rawObj, 'household_id')) {
    return validationError("Property 'household_id' must be a non-empty string");
  }
  if (!isNonEmptyStringProp(rawObj, 'created_at')) {
    return validationError("Property 'created_at' must be a non-empty string");
  }

  const base: BaseInventoryOperationV1 = {
    contract_version: CANONICAL_CONTRACT_VERSION,
    operation_id: rawObj.operation_id as string,
    household_id: rawObj.household_id as string,
    created_at: rawObj.created_at as string,
  };

  switch (canonicalType) {
    case 'insert_inventory': {
      if (!isNonEmptyStringProp(rawObj, 'item_id')) {
        return validationError("Property 'item_id' must be a non-empty string");
      }
      if (!isNonEmptyStringProp(rawObj, 'in_transaction_id')) {
        return validationError("Property 'in_transaction_id' must be a non-empty string");
      }
      if (!isNonEmptyStringProp(rawObj, 'product_name')) {
        return validationError("Property 'product_name' must be a non-empty string");
      }
      if (!isPositiveIntegerThousandths(rawObj.quantity)) {
        return validationError("Property 'quantity' must be a positive integer in thousandths");
      }
      if (!isNonEmptyStringProp(rawObj, 'unit')) {
        return validationError("Property 'unit' must be a non-empty string");
      }
      if (!isNonEmptyStringProp(rawObj, 'location_id')) {
        return validationError("Property 'location_id' must be a non-empty string");
      }
      if (
        'product_id' in rawObj &&
        rawObj.product_id !== undefined &&
        rawObj.product_id !== null &&
        typeof rawObj.product_id !== 'string'
      ) {
        return validationError("Property 'product_id' must be a string or null if present");
      }
      if (
        'expiry_date' in rawObj &&
        rawObj.expiry_date !== undefined &&
        rawObj.expiry_date !== null &&
        typeof rawObj.expiry_date !== 'string'
      ) {
        return validationError("Property 'expiry_date' must be a string or null if present");
      }
      if (
        'opened_at' in rawObj &&
        rawObj.opened_at !== undefined &&
        rawObj.opened_at !== null &&
        typeof rawObj.opened_at !== 'string'
      ) {
        return validationError("Property 'opened_at' must be a string or null if present");
      }

      const op: InsertInventoryOperationV1 = {
        ...base,
        type: 'insert_inventory',
        item_id: rawObj.item_id as string,
        in_transaction_id: rawObj.in_transaction_id as string,
        product_name: rawObj.product_name as string,
        quantity: rawObj.quantity as number,
        unit: rawObj.unit as string,
        location_id: rawObj.location_id as string,
      };
      if ('product_id' in rawObj && rawObj.product_id !== undefined) {
        op.product_id = rawObj.product_id as string | null;
      }
      if ('expiry_date' in rawObj && rawObj.expiry_date !== undefined) {
        op.expiry_date = rawObj.expiry_date as string | null;
      }
      if ('opened_at' in rawObj && rawObj.opened_at !== undefined) {
        op.opened_at = rawObj.opened_at as string | null;
      }
      return { success: true, data: op };
    }

    case 'open_inventory': {
      if (!isNonEmptyStringProp(rawObj, 'source_item_id')) {
        return validationError("Property 'source_item_id' must be a non-empty string");
      }
      if (!isNonNegativeIntegerThousandths(rawObj.expected_quantity)) {
        return validationError(
          "Property 'expected_quantity' must be a non-negative integer in thousandths",
        );
      }
      if (!isPositiveIntegerThousandths(rawObj.portion_quantity)) {
        return validationError(
          "Property 'portion_quantity' must be a positive integer in thousandths",
        );
      }
      if ((rawObj.portion_quantity as number) > (rawObj.expected_quantity as number)) {
        return validationError("Property 'portion_quantity' must not exceed 'expected_quantity'");
      }
      if (!isNonEmptyStringProp(rawObj, 'opened_at')) {
        return validationError("Property 'opened_at' must be a non-empty string");
      }
      if (
        'opened_item_id' in rawObj &&
        rawObj.opened_item_id !== undefined &&
        !isNonEmptyString(rawObj.opened_item_id)
      ) {
        return validationError("Property 'opened_item_id' must be a non-empty string if present");
      }
      const isSplit = (rawObj.expected_quantity as number) > (rawObj.portion_quantity as number);
      if (isSplit && !isNonEmptyString(rawObj.opened_item_id)) {
        return validationError(
          "Property 'opened_item_id' is required when expected_quantity exceeds portion_quantity",
        );
      }
      if (!isSplit && rawObj.opened_item_id !== undefined) {
        return validationError(
          "Property 'opened_item_id' must be absent when the whole lot is opened in place",
        );
      }

      const op: OpenInventoryOperationV1 = {
        ...base,
        type: 'open_inventory',
        source_item_id: rawObj.source_item_id as string,
        expected_quantity: rawObj.expected_quantity as number,
        portion_quantity: rawObj.portion_quantity as number,
        opened_at: rawObj.opened_at as string,
      };
      if (isSplit) {
        op.opened_item_id = rawObj.opened_item_id as string;
      }
      return { success: true, data: op };
    }

    case 'consume_inventory': {
      if (
        rawObj.mode !== 'sealed_full' &&
        rawObj.mode !== 'sealed_partial' &&
        rawObj.mode !== 'opened'
      ) {
        return validationError(
          "Property 'mode' must be 'sealed_full', 'sealed_partial', or 'opened'",
        );
      }
      if (!isNonEmptyStringProp(rawObj, 'out_transaction_id')) {
        return validationError("Property 'out_transaction_id' must be a non-empty string");
      }
      if (!isNonEmptyStringProp(rawObj, 'source_item_id')) {
        return validationError("Property 'source_item_id' must be a non-empty string");
      }
      if (!isNonNegativeIntegerThousandths(rawObj.expected_quantity)) {
        return validationError(
          "Property 'expected_quantity' must be a non-negative integer in thousandths",
        );
      }
      if (!isPositiveIntegerThousandths(rawObj.consumed_quantity)) {
        return validationError(
          "Property 'consumed_quantity' must be a positive integer in thousandths",
        );
      }
      if ((rawObj.consumed_quantity as number) > (rawObj.expected_quantity as number)) {
        return validationError("Property 'consumed_quantity' must not exceed 'expected_quantity'");
      }
      if (!isNonEmptyStringProp(rawObj, 'consumed_at')) {
        return validationError("Property 'consumed_at' must be a non-empty string");
      }
      for (const optionalKey of ['recipe_id', 'recipe_name', 'meal_plan_entry_id'] as const) {
        if (
          optionalKey in rawObj &&
          rawObj[optionalKey] !== undefined &&
          rawObj[optionalKey] !== null &&
          typeof rawObj[optionalKey] !== 'string'
        ) {
          return validationError(`Property '${optionalKey}' must be a string or null if present`);
        }
      }

      const optionalFields: Partial<ConsumeInventoryBaseV1> = {};
      if ('recipe_id' in rawObj && rawObj.recipe_id !== undefined) {
        optionalFields.recipe_id = rawObj.recipe_id as string | null;
      }
      if ('recipe_name' in rawObj && rawObj.recipe_name !== undefined) {
        optionalFields.recipe_name = rawObj.recipe_name as string | null;
      }
      if ('meal_plan_entry_id' in rawObj && rawObj.meal_plan_entry_id !== undefined) {
        optionalFields.meal_plan_entry_id = rawObj.meal_plan_entry_id as string | null;
      }

      const consumeBase = {
        ...base,
        type: 'consume_inventory' as const,
        out_transaction_id: rawObj.out_transaction_id as string,
        source_item_id: rawObj.source_item_id as string,
        expected_quantity: rawObj.expected_quantity as number,
        consumed_quantity: rawObj.consumed_quantity as number,
        consumed_at: rawObj.consumed_at as string,
        ...optionalFields,
      };

      if (rawObj.mode === 'sealed_partial') {
        if (!isNonEmptyStringProp(rawObj, 'opened_item_id')) {
          return validationError(
            "Property 'opened_item_id' must be a non-empty string for mode 'sealed_partial'",
          );
        }
        if (!isPositiveIntegerThousandths(rawObj.portion_quantity)) {
          return validationError(
            "Property 'portion_quantity' must be a positive integer in thousandths",
          );
        }
        if ((rawObj.consumed_quantity as number) >= (rawObj.portion_quantity as number)) {
          return validationError(
            "'consumed_quantity' must be strictly less than 'portion_quantity' for mode 'sealed_partial'",
          );
        }
        if ((rawObj.portion_quantity as number) > (rawObj.expected_quantity as number)) {
          return validationError("Property 'portion_quantity' must not exceed 'expected_quantity'");
        }
        if (!isNonEmptyStringProp(rawObj, 'opened_at')) {
          return validationError("Property 'opened_at' must be a non-empty string");
        }
        if (!validateMergeSnapshot(rawObj.merge_snapshot)) {
          return validationError("Property 'merge_snapshot' must be a valid MergeSnapshotV1");
        }

        const op: ConsumeSealedPartialOperationV1 = {
          ...consumeBase,
          mode: 'sealed_partial',
          opened_item_id: rawObj.opened_item_id as string,
          portion_quantity: rawObj.portion_quantity as number,
          opened_at: rawObj.opened_at as string,
          merge_snapshot: rawObj.merge_snapshot as MergeSnapshotV1,
        };
        return { success: true, data: op };
      }

      if (
        'opened_item_id' in rawObj ||
        'portion_quantity' in rawObj ||
        'merge_snapshot' in rawObj
      ) {
        return validationError(
          `Properties 'opened_item_id', 'portion_quantity' and 'merge_snapshot' are only allowed for mode 'sealed_partial'`,
        );
      }

      const op: ConsumeSealedFullOperationV1 | ConsumeOpenedOperationV1 = {
        ...consumeBase,
        mode: rawObj.mode as 'sealed_full' | 'opened',
      };
      return { success: true, data: op };
    }

    case 'waste_inventory': {
      if (!isNonEmptyStringProp(rawObj, 'waste_transaction_id')) {
        return validationError("Property 'waste_transaction_id' must be a non-empty string");
      }
      if (!isNonEmptyStringProp(rawObj, 'item_id')) {
        return validationError("Property 'item_id' must be a non-empty string");
      }
      if (rawObj.reason !== 'expired' && rawObj.reason !== 'spoiled' && rawObj.reason !== 'other') {
        return validationError("Property 'reason' must be 'expired', 'spoiled', or 'other'");
      }
      if (!isNonNegativeIntegerThousandths(rawObj.expected_quantity)) {
        return validationError(
          "Property 'expected_quantity' must be a non-negative integer in thousandths",
        );
      }
      if (!isPositiveIntegerThousandths(rawObj.waste_quantity)) {
        return validationError(
          "Property 'waste_quantity' must be a positive integer in thousandths",
        );
      }
      if ((rawObj.waste_quantity as number) > (rawObj.expected_quantity as number)) {
        return validationError("Property 'waste_quantity' must not exceed 'expected_quantity'");
      }

      const op: WasteInventoryOperationV1 = {
        ...base,
        type: 'waste_inventory',
        waste_transaction_id: rawObj.waste_transaction_id as string,
        item_id: rawObj.item_id as string,
        expected_quantity: rawObj.expected_quantity as number,
        waste_quantity: rawObj.waste_quantity as number,
        reason: rawObj.reason,
      };
      return { success: true, data: op };
    }

    case 'move_inventory': {
      if (!isNonEmptyStringProp(rawObj, 'out_transaction_id')) {
        return validationError("Property 'out_transaction_id' must be a non-empty string");
      }
      if (!isNonEmptyStringProp(rawObj, 'in_transaction_id')) {
        return validationError("Property 'in_transaction_id' must be a non-empty string");
      }
      if (!isNonEmptyStringProp(rawObj, 'item_id')) {
        return validationError("Property 'item_id' must be a non-empty string");
      }
      if (!isNonNegativeIntegerThousandths(rawObj.expected_quantity)) {
        return validationError(
          "Property 'expected_quantity' must be a non-negative integer in thousandths",
        );
      }
      if (!isNonEmptyStringProp(rawObj, 'expected_location_id')) {
        return validationError("Property 'expected_location_id' must be a non-empty string");
      }
      if (!isNonEmptyStringProp(rawObj, 'to_location_id')) {
        return validationError("Property 'to_location_id' must be a non-empty string");
      }
      if (rawObj.expected_location_id === rawObj.to_location_id) {
        return validationError("Property 'to_location_id' must differ from 'expected_location_id'");
      }

      const op: MoveInventoryOperationV1 = {
        ...base,
        type: 'move_inventory',
        out_transaction_id: rawObj.out_transaction_id as string,
        in_transaction_id: rawObj.in_transaction_id as string,
        item_id: rawObj.item_id as string,
        expected_quantity: rawObj.expected_quantity as number,
        expected_location_id: rawObj.expected_location_id as string,
        to_location_id: rawObj.to_location_id as string,
      };
      return { success: true, data: op };
    }

    case 'correct_quantity': {
      if (!isNonEmptyStringProp(rawObj, 'transaction_id')) {
        return validationError("Property 'transaction_id' must be a non-empty string");
      }
      if (!isNonEmptyStringProp(rawObj, 'item_id')) {
        return validationError("Property 'item_id' must be a non-empty string");
      }
      if (!isNonNegativeIntegerThousandths(rawObj.new_quantity)) {
        return validationError(
          "Property 'new_quantity' must be a non-negative integer in thousandths",
        );
      }
      if (!isNonNegativeIntegerThousandths(rawObj.expected_quantity)) {
        return validationError(
          "Property 'expected_quantity' must be a non-negative integer in thousandths",
        );
      }
      if (rawObj.new_quantity === rawObj.expected_quantity) {
        return validationError(
          "'new_quantity' must differ from 'expected_quantity' for quantity correction",
        );
      }

      const op: CorrectQuantityOperationV1 = {
        ...base,
        type: 'correct_quantity',
        transaction_id: rawObj.transaction_id as string,
        item_id: rawObj.item_id as string,
        new_quantity: rawObj.new_quantity as number,
        expected_quantity: rawObj.expected_quantity as number,
      };
      return { success: true, data: op };
    }

    case 'undo_inventory_operation': {
      if (!isNonEmptyStringProp(rawObj, 'reversal_of')) {
        return validationError("Property 'reversal_of' must be a non-empty string");
      }
      if (
        'notes' in rawObj &&
        rawObj.notes !== undefined &&
        rawObj.notes !== null &&
        typeof rawObj.notes !== 'string'
      ) {
        return validationError("Property 'notes' must be a string or null if present");
      }
      const notes: { notes?: string | null } =
        'notes' in rawObj && rawObj.notes !== undefined
          ? { notes: rawObj.notes as string | null }
          : {};

      if (rawObj.mode === 'reverse_quantity') {
        if (!isNonEmptyStringProp(rawObj, 'reversal_transaction_id')) {
          return validationError("Property 'reversal_transaction_id' must be a non-empty string");
        }
        if (!isNonEmptyStringProp(rawObj, 'item_id')) {
          return validationError("Property 'item_id' must be a non-empty string");
        }
        const op: UndoReverseQuantityOperationV1 = {
          ...base,
          type: 'undo_inventory_operation',
          mode: 'reverse_quantity',
          reversal_transaction_id: rawObj.reversal_transaction_id as string,
          reversal_of: rawObj.reversal_of as string,
          item_id: rawObj.item_id as string,
          ...notes,
        };
        return { success: true, data: op };
      }

      if (rawObj.mode === 'reverse_move') {
        if (!isNonEmptyStringProp(rawObj, 'reversal_out_transaction_id')) {
          return validationError(
            "Property 'reversal_out_transaction_id' must be a non-empty string",
          );
        }
        if (!isNonEmptyStringProp(rawObj, 'reversal_in_transaction_id')) {
          return validationError(
            "Property 'reversal_in_transaction_id' must be a non-empty string",
          );
        }
        if (!isNonEmptyStringProp(rawObj, 'item_id')) {
          return validationError("Property 'item_id' must be a non-empty string");
        }
        const op: UndoReverseMoveOperationV1 = {
          ...base,
          type: 'undo_inventory_operation',
          mode: 'reverse_move',
          reversal_out_transaction_id: rawObj.reversal_out_transaction_id as string,
          reversal_in_transaction_id: rawObj.reversal_in_transaction_id as string,
          reversal_of: rawObj.reversal_of as string,
          item_id: rawObj.item_id as string,
          ...notes,
        };
        return { success: true, data: op };
      }

      if (rawObj.mode === 'merge_undo_open') {
        if (!isNonEmptyStringProp(rawObj, 'in_transaction_id')) {
          return validationError("Property 'in_transaction_id' must be a non-empty string");
        }
        if (!isNonEmptyStringProp(rawObj, 'source_item_id')) {
          return validationError("Property 'source_item_id' must be a non-empty string");
        }
        if (!isNonEmptyStringProp(rawObj, 'opened_item_id')) {
          return validationError("Property 'opened_item_id' must be a non-empty string");
        }
        const op: UndoMergeUndoOpenOperationV1 = {
          ...base,
          type: 'undo_inventory_operation',
          mode: 'merge_undo_open',
          in_transaction_id: rawObj.in_transaction_id as string,
          reversal_of: rawObj.reversal_of as string,
          source_item_id: rawObj.source_item_id as string,
          opened_item_id: rawObj.opened_item_id as string,
          ...notes,
        };
        return { success: true, data: op };
      }

      return validationError(
        "Property 'mode' must be 'reverse_quantity', 'reverse_move', or 'merge_undo_open'",
      );
    }

    case 'reseal_inventory': {
      if (!isNonEmptyStringProp(rawObj, 'item_id')) {
        return validationError("Property 'item_id' must be a non-empty string");
      }
      const op: ResealInventoryOperationV1 = {
        ...base,
        type: 'reseal_inventory',
        item_id: rawObj.item_id as string,
      };
      return { success: true, data: op };
    }

    case 'patch_inventory_metadata': {
      if (!isNonEmptyStringProp(rawObj, 'item_id')) {
        return validationError("Property 'item_id' must be a non-empty string");
      }
      if (!isNonEmptyStringProp(rawObj, 'expected_updated_at')) {
        return validationError("Property 'expected_updated_at' must be a non-empty string");
      }

      const hasPatch =
        ('product_name' in rawObj && rawObj.product_name !== undefined) ||
        ('notes' in rawObj && rawObj.notes !== undefined) ||
        ('expiry_date' in rawObj && rawObj.expiry_date !== undefined);

      if (!hasPatch) {
        return validationError(
          "Metadata patch must include at least one property of 'product_name', 'notes', or 'expiry_date'",
        );
      }

      if ('product_name' in rawObj && rawObj.product_name !== undefined) {
        if (!isNonEmptyString(rawObj.product_name)) {
          return validationError("Property 'product_name' must be a non-empty string if present");
        }
      }

      if ('notes' in rawObj && rawObj.notes !== undefined && rawObj.notes !== null) {
        if (typeof rawObj.notes !== 'string') {
          return validationError("Property 'notes' must be a string or null if present");
        }
      }

      if (
        'expiry_date' in rawObj &&
        rawObj.expiry_date !== undefined &&
        rawObj.expiry_date !== null
      ) {
        if (typeof rawObj.expiry_date !== 'string') {
          return validationError("Property 'expiry_date' must be a string or null if present");
        }
      }

      const op: PatchInventoryMetadataOperationV1 = {
        ...base,
        type: 'patch_inventory_metadata',
        item_id: rawObj.item_id as string,
        expected_updated_at: rawObj.expected_updated_at as string,
      };
      if ('product_name' in rawObj && rawObj.product_name !== undefined) {
        op.product_name = rawObj.product_name as string;
      }
      if ('notes' in rawObj && rawObj.notes !== undefined) {
        op.notes = rawObj.notes as string | null;
      }
      if ('expiry_date' in rawObj && rawObj.expiry_date !== undefined) {
        op.expiry_date = rawObj.expiry_date as string | null;
      }
      return { success: true, data: op };
    }
  }
}

export function assertValidInventoryOperation(raw: unknown): InventoryOperationV1 {
  const result = validateInventoryOperation(raw);
  if (!result.success) {
    const error = new Error(result.error.message);
    (error as unknown as { code: string }).code = result.error.code;
    throw error;
  }
  return result.data;
}

const emptyFootprint = (): InventoryOperationFootprint => ({
  lots: { created: [], modified: [], restored: [], tombstoned: [] },
  transactions: { created: [], reversals: [] },
});

export function computeInventoryOperationFootprint(
  op: InventoryOperationV1,
): InventoryOperationFootprint {
  const footprint = emptyFootprint();

  switch (op.type) {
    case 'insert_inventory':
      footprint.lots.created.push(op.item_id);
      footprint.transactions.created.push(op.in_transaction_id);
      return footprint;

    case 'open_inventory':
      if (op.opened_item_id) {
        footprint.lots.created.push(op.opened_item_id);
        footprint.lots.modified.push(op.source_item_id);
      } else {
        footprint.lots.modified.push(op.source_item_id);
      }
      return footprint;

    case 'consume_inventory': {
      const boundary = op.mode === 'sealed_partial' ? op.portion_quantity : op.consumed_quantity;
      const sourceAfter = op.expected_quantity - boundary;
      if (sourceAfter === 0) {
        footprint.lots.tombstoned.push(op.source_item_id);
      } else {
        footprint.lots.modified.push(op.source_item_id);
      }
      if (op.mode === 'sealed_partial') {
        footprint.lots.created.push(op.opened_item_id);
      }
      footprint.transactions.created.push(op.out_transaction_id);
      return footprint;
    }

    case 'waste_inventory': {
      const after = op.expected_quantity - op.waste_quantity;
      if (after === 0) {
        footprint.lots.tombstoned.push(op.item_id);
      } else {
        footprint.lots.modified.push(op.item_id);
      }
      footprint.transactions.created.push(op.waste_transaction_id);
      return footprint;
    }

    case 'move_inventory':
      footprint.lots.modified.push(op.item_id);
      footprint.transactions.created.push(op.out_transaction_id, op.in_transaction_id);
      return footprint;

    case 'correct_quantity':
      if (op.new_quantity === 0) {
        footprint.lots.tombstoned.push(op.item_id);
      } else {
        footprint.lots.modified.push(op.item_id);
      }
      footprint.transactions.created.push(op.transaction_id);
      return footprint;

    case 'undo_inventory_operation':
      if (op.mode === 'reverse_quantity') {
        footprint.lots.modified.push(op.item_id);
        footprint.transactions.created.push(op.reversal_transaction_id);
        footprint.transactions.reversals.push(op.reversal_of);
        return footprint;
      }
      if (op.mode === 'reverse_move') {
        footprint.lots.modified.push(op.item_id);
        footprint.transactions.created.push(
          op.reversal_out_transaction_id,
          op.reversal_in_transaction_id,
        );
        footprint.transactions.reversals.push(op.reversal_of);
        return footprint;
      }
      // merge_undo_open: Quelle wird reaktiviert, geöffneter Rest wird tombstoned.
      footprint.lots.restored.push(op.source_item_id);
      footprint.lots.tombstoned.push(op.opened_item_id);
      footprint.transactions.created.push(op.in_transaction_id);
      footprint.transactions.reversals.push(op.reversal_of);
      return footprint;

    case 'reseal_inventory':
      footprint.lots.modified.push(op.item_id);
      return footprint;

    case 'patch_inventory_metadata':
      footprint.lots.modified.push(op.item_id);
      return footprint;
  }
}
