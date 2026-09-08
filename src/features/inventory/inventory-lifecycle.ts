import {
  fromInventoryQuantityUnits,
  INVENTORY_QUANTITY_SCALE,
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

export type LifecycleTransaction = {
  id?: string;
  householdId: string;
  fridgeItemId: string | null;
  /** Stable reference to the sealed source row of a split. */
  originItemId?: string | null;
  /** Source quantity before the split, used to detect a changed source lot. */
  originQuantity?: number | null;
  productId: string | null;
  actor?: string | null;
  type: InventoryTransactionType;
  quantity: number;
  locationId: string | null;
  reason?: string | null;
  previousExpiryDate: string | null;
  notes?: string | null;
  undone?: boolean;
  createdAt: string;
};

export type OpenInventoryPlan = {
  originalPatch: Partial<LifecycleItem>;
  openedItem: LifecycleItem | null;
  transaction: LifecycleTransaction;
};

export type UndoOpenTransaction = LifecycleTransaction & {
  type: 'open';
};

export type UndoOpenPlan = {
  mode: 'restore-in-place' | 'merge-split' | 'fallback';
  openedPatch: Partial<LifecycleItem> | null;
  sealedPatch: Partial<LifecycleItem> | null;
  deleteOpenedItem: boolean;
};

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;
const SPLIT_NOTE_PREFIX = '[Split] origin=';

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
  type: InventoryTransactionType,
): string {
  if (mode === 'manual-correction') return '[Manual correction]';
  return type === 'open' ? '[Undone] Öffnung rückgängig gemacht' : '[Undone] Gegenbuchung';
}

export function splitTransactionNotes(originItemId: string): string {
  return `${SPLIT_NOTE_PREFIX}${originItemId}`;
}

export function getSplitOriginItemId(
  transaction: Pick<LifecycleTransaction, 'originItemId' | 'notes'>,
): string | null {
  if (transaction.originItemId) return transaction.originItemId;
  if (!transaction.notes?.startsWith(SPLIT_NOTE_PREFIX)) return null;
  const originItemId = transaction.notes.slice(SPLIT_NOTE_PREFIX.length).trim();
  return originItemId.length > 0 ? originItemId : null;
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

  const transaction: LifecycleTransaction = {
    householdId: item.householdId,
    fridgeItemId: isSingleUnit ? item.id : openedItemId,
    ...(isSingleUnit ? {} : { originItemId: item.id, originQuantity: item.quantity }),
    productId: item.productId,
    type: 'open',
    quantity,
    locationId: item.locationId,
    previousExpiryDate: item.expiryDate,
    notes: itemUnits > INVENTORY_QUANTITY_SCALE ? splitTransactionNotes(item.id) : null,
    createdAt: openedAtIso,
  };

  if (isSingleUnit) {
    return {
      originalPatch: {
        openedAt: openedAtIso,
        expiryDate,
        expiryUserSet,
        vacuumSealed: item.vacuumSealed,
      },
      openedItem: null,
      transaction,
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
    transaction,
  };
}

export function canUndoTransaction(createdAt: Date, now: Date): boolean {
  const age = now.getTime() - createdAt.getTime();
  return age >= 0 && age <= UNDO_WINDOW_MS;
}

function sameSplitIdentity(
  openedItem: LifecycleItem,
  sealedItem: LifecycleItem,
  transaction: UndoOpenTransaction,
): boolean {
  const sealedUnits = toInventoryQuantityUnits(sealedItem.quantity);
  const openedUnits = toInventoryQuantityUnits(openedItem.quantity);
  const transactionUnits = toInventoryQuantityUnits(transaction.quantity);
  const originUnits =
    transaction.originQuantity === undefined || transaction.originQuantity === null
      ? null
      : toInventoryQuantityUnits(transaction.originQuantity);

  // updated_at is server-generated and is not the opening event's version.
  // The stable origin id, source quantity and business attributes below decide
  // whether this is still the same split pair.
  return (
    getSplitOriginItemId(transaction) === sealedItem.id &&
    originUnits !== null &&
    originUnits === sealedUnits + transactionUnits &&
    openedItem.id === transaction.fridgeItemId &&
    openedItem.householdId === sealedItem.householdId &&
    openedItem.productId === sealedItem.productId &&
    openedItem.locationId === sealedItem.locationId &&
    openedItem.name === sealedItem.name &&
    openedItem.unit === sealedItem.unit &&
    openedItem.packageSize === sealedItem.packageSize &&
    openedItem.packageSizeUnit === sealedItem.packageSizeUnit &&
    openedItem.addedBy === sealedItem.addedBy &&
    openedItem.category === sealedItem.category &&
    openedItem.locationKind === sealedItem.locationKind &&
    openedItem.vacuumSealed === sealedItem.vacuumSealed &&
    openedItem.expiryUserSet === sealedItem.expiryUserSet &&
    openedUnits === transactionUnits &&
    openedItem.openedAt !== null &&
    sealedItem.openedAt === null &&
    sealedItem.expiryDate === transaction.previousExpiryDate
  );
}

/** Plant den sicheren Undo-Pfad. Ein veränderter Split-Lot wird nicht destruktiv zusammengeführt. */
export function planUndoOpenTransaction(
  transaction: UndoOpenTransaction,
  openedItem: LifecycleItem,
  sealedItem: LifecycleItem | null,
  now: Date,
): UndoOpenPlan {
  const createdAt = new Date(transaction.createdAt);
  if (!canUndoTransaction(createdAt, now))
    throw new Error('Diese Öffnung kann nicht mehr rückgängig gemacht werden.');
  if (transaction.undone || transaction.notes?.includes('[Undone]')) {
    throw new Error('Diese Öffnung wurde bereits rückgängig gemacht.');
  }

  if (sealedItem && sameSplitIdentity(openedItem, sealedItem, transaction)) {
    return {
      mode: 'merge-split',
      openedPatch: null,
      sealedPatch: {
        quantity: fromInventoryQuantityUnits(
          toInventoryQuantityUnits(sealedItem.quantity) +
            toInventoryQuantityUnits(transaction.quantity),
        ),
      },
      deleteOpenedItem: true,
    };
  }

  if (
    !sealedItem &&
    !getSplitOriginItemId(transaction) &&
    openedItem.id === transaction.fridgeItemId
  ) {
    return {
      mode: 'restore-in-place',
      openedPatch: {
        openedAt: null,
        expiryDate: transaction.previousExpiryDate,
        expiryUserSet: openedItem.expiryUserSet,
        vacuumSealed: openedItem.vacuumSealed,
      },
      sealedPatch: null,
      deleteOpenedItem: false,
    };
  }

  return {
    mode: 'fallback',
    openedPatch: null,
    sealedPatch: null,
    deleteOpenedItem: false,
  };
}

export function inverseTransactionType(type: InventoryTransactionType): InventoryTransactionType {
  if (type === 'in') return 'out';
  if (type === 'waste' || type === 'out') return 'in';
  return 'open';
}
