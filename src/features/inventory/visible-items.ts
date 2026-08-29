import { compareByExpiry, getExpiryInfo } from './expiry';
import { groupInventoryItems, type InventoryItemGroup } from './grouped-items';
import type { LocalInventoryItem } from './use-inventory-items';

export type InventorySortMode = 'expiry' | 'name';

export interface VisibleInventoryOptions {
  /** Lagerort-Tab; 'all' zeigt alle Lagerorte. */
  locationId: string;
  /** Dashboard-Filter (#73): nur abgelaufene und kritische Artikel. */
  showExpiringOnly: boolean;
  searchQuery: string;
  sortMode: InventorySortMode;
  today: Date;
}

/**
 * Filtert und sortiert den Vorrat für die Anzeige. Bewusst ohne React: seit der
 * FlashList-Migration (#139) spiegelt die Render-Reihenfolge im Testbaum wegen
 * View-Recycling nicht mehr die Datenreihenfolge, die Sortierung wird deshalb
 * hier geprüft statt am Screen.
 */
export function selectVisibleInventoryItems(
  items: LocalInventoryItem[],
  { locationId, showExpiringOnly, searchQuery, sortMode, today }: VisibleInventoryOptions,
): InventoryItemGroup[] {
  let result = items;
  if (locationId !== 'all') {
    result = result.filter((item) => item.location_id === locationId);
  }
  const query = searchQuery.trim().toLowerCase();
  if (query) {
    result = result.filter((item) => item.name.toLowerCase().includes(query));
  }

  const groups = groupInventoryItems(result, today);
  const visibleGroups = showExpiringOnly
    ? groups.filter((group) =>
        group.lots.some((lot) =>
          ['expired', 'critical'].includes(getExpiryInfo(lot.expiry_date, today).bucket),
        ),
      )
    : groups;

  return visibleGroups.sort((a, b) =>
    sortMode === 'name' ? a.name.localeCompare(b.name, 'de') : compareByExpiry(a.expiry, b.expiry),
  );
}
