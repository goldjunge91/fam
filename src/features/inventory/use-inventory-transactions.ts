import { useQuery } from '@tanstack/react-query';

import { getDatabase } from '@/lib/db/client';

export type InventoryTransactionType = 'in' | 'out' | 'waste' | 'open';

export type LocalInventoryTransaction = {
  id: string;
  household_id: string;
  fridge_item_id: string | null;
  product_id: string | null;
  actor: string | null;
  type: InventoryTransactionType;
  quantity: number;
  location_id: string | null;
  reason: 'expired' | 'spoiled' | 'other' | null;
  previous_expiry_date: string | null;
  notes: string | null;
  undone: boolean;
  created_at: string;
  /** Display-only joins from the local mirror. */
  item_name?: string | null;
  item_unit?: string | null;
  location_name?: string | null;
};

export function useInventoryTransactions(householdId: string | undefined) {
  return useQuery({
    queryKey: ['transactions', householdId],
    queryFn: async (): Promise<LocalInventoryTransaction[]> => {
      if (!householdId) return [];

      const db = await getDatabase();
      return db.getAllAsync<LocalInventoryTransaction>(
        `select t.id, t.household_id, t.fridge_item_id, t.product_id, t.actor, t.type,
                t.quantity, t.location_id, t.reason, t.previous_expiry_date, t.notes,
                t.undone, t.created_at,
                coalesce(fi.name, p.name) as item_name,
                fi.unit as item_unit,
                sl.name as location_name
           from transactions t
           left join fridge_items fi on fi.id = t.fridge_item_id
           left join products p on p.id = t.product_id
           left join storage_locations sl on sl.id = t.location_id
          where t.household_id = ?
          order by t.created_at desc, t.id desc`,
        [householdId],
      );
    },
    enabled: !!householdId,
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

function formatCalendarDate(value: Date): string {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${value.getFullYear()}`;
}

export function groupTransactionsByDay(
  transactions: LocalInventoryTransaction[],
  now = new Date(),
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
        ? 'Heute'
        : day === yesterday
          ? 'Gestern'
          : Number.isNaN(day)
            ? 'Ohne Datum'
            : formatCalendarDate(date);
    const existing = groups.get(key);
    if (existing) existing.transactions.push(transaction);
    else groups.set(key, { key, label, transactions: [transaction] });
  }

  return [...groups.values()];
}

export function transactionLabel(
  transaction: LocalInventoryTransaction,
  itemName?: string | null,
): string {
  const name = itemName?.trim();
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

export function transactionReasonLabel(reason: LocalInventoryTransaction['reason']): string | null {
  if (reason === 'expired') return 'Abgelaufen';
  if (reason === 'spoiled') return 'Schlecht geworden';
  if (reason === 'other') return 'Sonstiges';
  return null;
}
