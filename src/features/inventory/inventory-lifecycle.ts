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
};

export type LifecycleTransaction = {
  id?: string;
  householdId: string;
  fridgeItemId: string | null;
  productId: string | null;
  actor?: string | null;
  type: InventoryTransactionType;
  quantity: number;
  locationId: string | null;
  reason?: string | null;
  previousExpiryDate: string | null;
  notes?: string | null;
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

function toIsoTimestamp(value: Date): string {
  return value.toISOString();
}

function assertValidOpenQuantity(item: LifecycleItem, quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > item.quantity) {
    throw new Error(
      'Die Öffnungsmenge muss größer als 0 und höchstens der Bestandsmenge entsprechen.',
    );
  }
}

/** Erstellt alle lokalen Änderungen für eine Öffnung, ohne Datenbankzugriff. */
export function planOpenInventoryItem(
  item: LifecycleItem,
  quantity: number,
  openedAt: Date,
  openedItemId: string,
): OpenInventoryPlan {
  assertValidOpenQuantity(item, quantity);
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
  const isSingleUnit = item.quantity === 1;
  const expiryUserSet = item.expiryUserSet && expiryDate === item.expiryDate;

  const transaction: LifecycleTransaction = {
    householdId: item.householdId,
    fridgeItemId: isSingleUnit ? item.id : openedItemId,
    productId: item.productId,
    type: 'open',
    quantity,
    locationId: item.locationId,
    previousExpiryDate: item.expiryDate,
    notes: item.quantity > 1 ? '[Split]' : null,
    createdAt: openedAtIso,
  };

  if (isSingleUnit) {
    return {
      originalPatch: {
        openedAt: openedAtIso,
        expiryDate,
        expiryUserSet,
        vacuumSealed: false,
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
    expiryUserSet: false,
    vacuumSealed: false,
  };

  return {
    originalPatch: { quantity: item.quantity - quantity },
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
  return (
    transaction.notes === '[Split]' &&
    openedItem.id === transaction.fridgeItemId &&
    openedItem.householdId === sealedItem.householdId &&
    openedItem.productId === sealedItem.productId &&
    openedItem.locationId === sealedItem.locationId &&
    openedItem.unit === sealedItem.unit &&
    openedItem.quantity === transaction.quantity &&
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

  if (sealedItem && sameSplitIdentity(openedItem, sealedItem, transaction)) {
    return {
      mode: 'merge-split',
      openedPatch: null,
      sealedPatch: { quantity: sealedItem.quantity + transaction.quantity },
      deleteOpenedItem: true,
    };
  }

  if (!sealedItem && openedItem.id === transaction.fridgeItemId) {
    return {
      mode: 'restore-in-place',
      openedPatch: {
        openedAt: null,
        expiryDate: transaction.previousExpiryDate,
        expiryUserSet: false,
        vacuumSealed: false,
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
