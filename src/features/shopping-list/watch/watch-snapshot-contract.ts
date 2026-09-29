import { colorForCategory } from '../domain-logik/shopping-categories';
import type { LocalShoppingItem } from '../hooks/use-shopping-list';

export const WATCH_SNAPSHOT_KEY = 'fam.shopping.snapshot';

export type WatchShoppingItem = {
  id: string;
  name: string;
  quantityLabel: string;
  category: string;
  categoryColor: string | null;
  isChecked: boolean;
};

export type WatchShoppingStore = {
  id: string;
  name: string;
  items: WatchShoppingItem[];
};

export type WatchShoppingSnapshot = {
  householdId: string | null;
  storeName: string | null;
  updatedAt: string;
  items: WatchShoppingItem[];
  stores: WatchShoppingStore[];
};

export function createWatchShoppingSnapshot(
  items: readonly LocalShoppingItem[],
  storeName: string | null,
  stores: readonly { id: string; name: string }[] = [],
  householdId: string | null = null,
): WatchShoppingSnapshot {
  const watchItems = toWatchShoppingItems(items);
  const watchStores = stores
    .map((store) => ({
      id: store.id,
      name: store.name,
      items: toWatchShoppingItems(items.filter((item) => item.store_id === store.id)),
    }))
    .filter((store) => store.items.length > 0);
  const unassignedItems = items.filter((item) => item.store_id === null);

  if (unassignedItems.length > 0) {
    watchStores.push({
      id: 'unassigned',
      name: 'Ohne Markt',
      items: toWatchShoppingItems(unassignedItems),
    });
  }

  return {
    householdId,
    storeName,
    updatedAt: new Date().toISOString(),
    items: watchItems,
    stores: watchStores,
  };
}

function toWatchShoppingItems(items: readonly LocalShoppingItem[]): WatchShoppingItem[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    quantityLabel: `${item.quantity} ${item.unit}`.trim(),
    category: item.category ?? 'Sonstiges',
    categoryColor: colorForCategory(item.category ?? 'Sonstiges'),
    isChecked: item.checked_at !== null,
  }));
}
