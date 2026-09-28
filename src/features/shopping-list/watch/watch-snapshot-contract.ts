import type { LocalShoppingItem } from '../hooks/use-shopping-list';

export const WATCH_SNAPSHOT_KEY = 'fam.shopping.snapshot';

export type WatchShoppingItem = {
  id: string;
  name: string;
  quantityLabel: string;
  category: string;
  isChecked: boolean;
};

export type WatchShoppingSnapshot = {
  storeName: string | null;
  updatedAt: string;
  items: WatchShoppingItem[];
};

export function createWatchShoppingSnapshot(
  items: readonly LocalShoppingItem[],
  storeName: string | null,
): WatchShoppingSnapshot {
  return {
    storeName,
    updatedAt: new Date().toISOString(),
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      quantityLabel: `${item.quantity} ${item.unit}`.trim(),
      category: item.category ?? 'Sonstiges',
      isChecked: item.checked_at !== null,
    })),
  };
}
