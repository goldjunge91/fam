import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';

import { getDatabase } from '@/lib/db/local-client';
import { fromInventoryQuantityUnits } from '@/lib/inventory-quantity';
import type { InventoryTransactionType } from './inventory-lifecycle';

export type { InventoryTransactionType };

export type LocalInventoryTransaction = {
  id: string;
  operation_id?: string | null;
  operation_legs?: number;
  reversal_of?: string | null;
  household_id: string;
  fridge_item_id: string | null;
  product_id: string | null;
  actor: string | null;
  type: InventoryTransactionType;
  quantity: number;
  location_id: string | null;
  reason: 'expired' | 'spoiled' | 'other' | null;
  previous_expiry_date: string | null;
  origin_item_id?: string | null;
  origin_quantity?: number | null;
  notes: string | null;
  undone: boolean;
  has_reversal?: boolean | number;
  created_at: string;
  /** Display-only joins from the local mirror. */
  item_name?: string | null;
  item_unit?: string | null;
  location_name?: string | null;
};

export function isInventoryMoveTransaction(transaction: LocalInventoryTransaction): boolean {
  return (
    transaction.operation_id !== undefined &&
    transaction.operation_id !== null &&
    transaction.operation_legs === 2
  );
}

const INVENTORY_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Returns whether the history may offer the single user-facing Undo action. */
export function isInventoryTransactionUndoable(
  transaction: LocalInventoryTransaction,
  now = new Date(),
): boolean {
  if (
    transaction.undone ||
    transaction.notes?.includes('[Undone]') ||
    (transaction.reversal_of !== undefined && transaction.reversal_of !== null) ||
    transaction.has_reversal === true ||
    transaction.has_reversal === 1
  ) {
    return false;
  }

  // A move has two ledger legs but represents one user action. The in-leg is
  // the stable history row that exposes Undo; the mutation hook reverses both.
  if (isInventoryMoveTransaction(transaction) && transaction.type !== 'in') return false;

  const createdAt = new Date(transaction.created_at).getTime();
  const age = now.getTime() - createdAt;
  return Number.isFinite(createdAt) && age >= 0 && age <= INVENTORY_UNDO_WINDOW_MS;
}

export function transactionUndoLabel(
  transaction: LocalInventoryTransaction,
  t?: TFunction,
): string {
  if (!t) {
    if (isInventoryMoveTransaction(transaction)) return 'Verschiebung rückgängig machen';
    if (transaction.type === 'in') return 'Einkauf rückgängig machen';
    if (transaction.type === 'out') return 'Verbrauch rückgängig machen';
    if (transaction.type === 'open') return 'Öffnen rückgängig machen';
    return 'Verschwendung rückgängig machen';
  }
  if (isInventoryMoveTransaction(transaction)) return t('inventory.transactions.moveUndo');
  if (transaction.type === 'in') return t('inventory.transactions.inUndo');
  if (transaction.type === 'out') return t('inventory.transactions.outUndo');
  if (transaction.type === 'open') return t('inventory.transactions.openUndo');
  return t('inventory.transactions.wasteUndo');
}

export function useInventoryTransactions(householdId: string | undefined) {
  return useQuery({
    queryKey: ['transactions', householdId],
    queryFn: async (): Promise<LocalInventoryTransaction[]> => {
      if (!householdId) return [];

      const db = await getDatabase();
      const rows = await db.getAllAsync<LocalInventoryTransaction>(
        `select t.id, t.household_id, t.fridge_item_id, t.product_id, t.actor, t.type,
                t.quantity, t.location_id, t.reason, t.previous_expiry_date, t.notes,
                t.origin_item_id, t.origin_quantity,
                t.undone, t.created_at, t.operation_id, t.reversal_of,
                case
                  when t.operation_id is null then 0
                  else (
                    select count(*)
                      from transactions operation_leg
                     where operation_leg.household_id = t.household_id
                       and operation_leg.operation_id = t.operation_id
                  )
                end as operation_legs,
                case
                  when t.operation_id is not null
                    and (
                      select count(*)
                        from transactions operation_leg
                       where operation_leg.household_id = t.household_id
                         and operation_leg.operation_id = t.operation_id
                    ) = 2
                  then exists (
                    select 1
                      from transactions reversal
                     where reversal.household_id = t.household_id
                       and reversal.reversal_of = t.operation_id
                  )
                  else exists (
                    select 1
                      from transactions reversal
                     where reversal.household_id = t.household_id
                       and reversal.reversal_of = t.id
                  )
                end as has_reversal,
                coalesce(fi.name, ofi.name, p.name) as item_name,
                coalesce(fi.unit, ofi.unit) as item_unit,
                sl.name as location_name
           from transactions t
           left join fridge_items fi on fi.id = t.fridge_item_id
           left join fridge_items ofi on ofi.id = t.origin_item_id
           left join products p on p.id = t.product_id
           left join storage_locations sl on sl.id = t.location_id
          where t.household_id = ?
          order by t.created_at desc, t.id desc`,
        [householdId],
      );

      return rows.map((row) => ({
        ...row,
        quantity: fromInventoryQuantityUnits(row.quantity),
        origin_quantity:
          row.origin_quantity !== null && row.origin_quantity !== undefined
            ? fromInventoryQuantityUnits(row.origin_quantity)
            : null,
      }));
    },
    enabled: !!householdId,
    networkMode: 'always',
  });
}

export function filterTransactionsForProduct(
  transactions: LocalInventoryTransaction[],
  productId: string | null,
  fridgeItemIds: ReadonlySet<string>,
): LocalInventoryTransaction[] {
  return transactions.filter(
    (transaction) =>
      (productId !== null && transaction.product_id === productId) ||
      (transaction.fridge_item_id !== null && fridgeItemIds.has(transaction.fridge_item_id)),
  );
}

export type TransactionDayGroup = {
  key: string;
  label: string;
  transactions: LocalInventoryTransaction[];
};

function localDayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function formatCalendarDate(value: Date, locale: string): string {
  return value.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function groupTransactionsByDay(
  transactions: LocalInventoryTransaction[],
  now = new Date(),
  t?: TFunction,
  locale = 'de-DE',
): TransactionDayGroup[] {
  const today = startOfLocalDay(now).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const groups = new Map<string, TransactionDayGroup>();

  for (const transaction of transactions) {
    const key = localDayKey(transaction.created_at);
    const date = new Date(transaction.created_at);
    const day = Number.isNaN(date.getTime()) ? Number.NaN : startOfLocalDay(date).getTime();
    const label =
      day === today
        ? (t?.('inventory.transactions.today') ?? 'Heute')
        : day === yesterday
          ? (t?.('inventory.transactions.yesterday') ?? 'Gestern')
          : Number.isNaN(day)
            ? (t?.('inventory.transactions.unknownDate') ?? 'Ohne Datum')
            : formatCalendarDate(date, locale);
    const existing = groups.get(key);
    if (existing) existing.transactions.push(transaction);
    else groups.set(key, { key, label, transactions: [transaction] });
  }

  return [...groups.values()];
}

export function transactionLabel(
  transaction: LocalInventoryTransaction,
  itemName?: string | null,
  t?: TFunction,
): string {
  const resolvedName = itemName !== undefined ? itemName : transaction.item_name;
  const name = resolvedName?.trim();
  if (!t) {
    if (transaction.notes?.includes('[Manual correction]')) {
      return name ? `Manuelle Korrektur: ${name}` : 'Manuelle Korrektur';
    }
    if (transaction.type === 'in') return name ? `${name} eingekauft` : 'Eingekauft';
    if (transaction.type === 'out') return name ? `${name} verbraucht` : 'Verbraucht';
    if (transaction.type === 'open') return name ? `${name} geöffnet` : 'Geöffnet';
    if (transaction.reason === 'expired') return name ? `${name} weggeworfen` : 'Abgelaufen';
    if (transaction.reason === 'spoiled') return name ? `${name} weggeworfen` : 'Schlecht geworden';
    return name ? `${name} weggeworfen` : 'Verschwendung';
  }
  if (transaction.notes?.includes('[Manual correction]')) {
    return name
      ? t('inventory.transactions.manualCorrectionNamed', { name })
      : t('inventory.transactions.manualCorrection');
  }
  if (transaction.type === 'in') {
    return name ? t('inventory.transactions.inNamed', { name }) : t('inventory.transactions.in');
  }
  if (transaction.type === 'out') {
    return name ? t('inventory.transactions.outNamed', { name }) : t('inventory.transactions.out');
  }
  if (transaction.type === 'open') {
    return name
      ? t('inventory.transactions.openNamed', { name })
      : t('inventory.transactions.open');
  }
  if (transaction.reason === 'expired') {
    return name
      ? t('inventory.transactions.expiredNamed', { name })
      : t('inventory.transactions.expired');
  }
  if (transaction.reason === 'spoiled') {
    return name
      ? t('inventory.transactions.spoiledNamed', { name })
      : t('inventory.transactions.spoiled');
  }
  return name
    ? t('inventory.transactions.wasteNamed', { name })
    : t('inventory.transactions.waste');
}

export function transactionReasonLabel(
  reason: LocalInventoryTransaction['reason'],
  t?: TFunction,
): string | null {
  if (reason === 'expired') return t?.('inventory.transactions.reasonExpired') ?? 'Abgelaufen';
  if (reason === 'spoiled')
    return t?.('inventory.transactions.reasonSpoiled') ?? 'Schlecht geworden';
  if (reason === 'other') return t?.('inventory.transactions.reasonOther') ?? 'Sonstiges';
  return null;
}
