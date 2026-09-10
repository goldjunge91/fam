import { useQuery } from '@tanstack/react-query';

import type { InventoryTransactionType } from '@/features/inventory/inventory-lifecycle';
import { getDatabase } from '@/lib/db/client';

export type LocalInventoryTransaction = {
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
  has_reversal: boolean;
  operation_leg_count: number;
  item_name: string | null;
  item_unit: string | null;
  location_name: string | null;
};

type LocalInventoryTransactionRow = Omit<LocalInventoryTransaction, 'has_reversal'> & {
  has_reversal: boolean | number;
};

export type InventoryTransactionGroup = {
  key: string;
  label: string;
  transactions: LocalInventoryTransaction[];
};

const TRANSACTION_QUERY = `
  select
    t.id,
    t.operation_id,
    t.reversal_of,
    t.household_id,
    t.fridge_item_id,
    t.product_id,
    t.actor,
    t.type,
    t.quantity,
    t.unit,
    t.location_id,
    t.reason,
    t.notes,
    t.created_at,
    exists (
      select 1
      from transactions reversal
      where reversal.reversal_of = t.id
        and reversal.household_id = t.household_id
    ) as has_reversal,
    (
      select count(*)
      from transactions leg
      where leg.operation_id = t.operation_id
        and leg.household_id = t.household_id
    ) as operation_leg_count,
    fi.name as item_name,
    fi.unit as item_unit,
    sl.name as location_name
  from transactions t
  left join fridge_items fi
    on fi.id = t.fridge_item_id and fi.household_id = t.household_id
  left join storage_locations sl
    on sl.id = t.location_id and sl.household_id = t.household_id
  where t.household_id = ?
  order by t.created_at desc, t.id desc
`;

function mapTransaction(row: LocalInventoryTransactionRow): LocalInventoryTransaction {
  return {
    ...row,
    has_reversal: row.has_reversal === true || row.has_reversal === 1,
  };
}

function compareTransactions(
  left: LocalInventoryTransaction,
  right: LocalInventoryTransaction,
): number {
  const createdAt = right.created_at.localeCompare(left.created_at);
  return createdAt === 0 ? right.id.localeCompare(left.id) : createdAt;
}

function dayKey(createdAt: string): string {
  const timestamp = Date.parse(createdAt);
  return Number.isNaN(timestamp)
    ? createdAt.slice(0, 10)
    : new Date(timestamp).toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  const [year, month, day] = key.split('-');
  return year && month && day ? `${day}.${month}.${year}` : key;
}

export function useInventoryTransactions(householdId: string | undefined) {
  return useQuery({
    queryKey: ['transactions', householdId],
    queryFn: async (): Promise<LocalInventoryTransaction[]> => {
      if (!householdId) return [];

      const db = await getDatabase();
      const rows = await db.getAllAsync<LocalInventoryTransactionRow>(TRANSACTION_QUERY, [
        householdId,
      ]);
      return rows.map(mapTransaction);
    },
    enabled: Boolean(householdId),
  });
}

export function filterTransactionsForProduct(
  transactions: readonly LocalInventoryTransaction[],
  productId: string | null,
  lotIds: ReadonlySet<string> = new Set(),
): LocalInventoryTransaction[] {
  return transactions.filter(
    (transaction) =>
      (productId !== null && transaction.product_id === productId) ||
      lotIds.has(transaction.fridge_item_id),
  );
}

export function groupInventoryTransactions(
  transactions: readonly LocalInventoryTransaction[],
): InventoryTransactionGroup[] {
  const groups = new Map<string, LocalInventoryTransaction[]>();
  for (const transaction of [...transactions].sort(compareTransactions)) {
    const key = dayKey(transaction.created_at);
    const group = groups.get(key);
    if (group) group.push(transaction);
    else groups.set(key, [transaction]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, groupedTransactions]) => ({
      key,
      label: dayLabel(key),
      transactions: groupedTransactions,
    }));
}

export function getInventoryTransactionLabel(
  transaction: Pick<LocalInventoryTransaction, 'type' | 'reversal_of' | 'operation_leg_count'>,
): string {
  if (transaction.reversal_of !== null) return 'Rückbuchung';
  if (transaction.operation_leg_count > 1) return 'Verschiebung';
  if (transaction.type === 'in') return 'Einkauf';
  if (transaction.type === 'waste') return 'Verschwendung';
  return 'Verbrauch';
}
