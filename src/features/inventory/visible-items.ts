import { compareByExpiry, getExpiryInfo } from './expiry';
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
): LocalInventoryItem[] {
  let result = items;
  if (locationId !== 'all') {
    result = result.filter((item) => item.location_id === locationId);
  }
  if (showExpiringOnly) {
    result = result.filter((item) =>
      ['expired', 'critical'].includes(getExpiryInfo(item.expiry_date, today).bucket),
    );
  }
  const query = searchQuery.trim().toLowerCase();
  if (query) {
    result = result.filter((item) => item.name.toLowerCase().includes(query));
  }
  return [...result].sort((a, b) =>
    sortMode === 'name'
      ? a.name.localeCompare(b.name, 'de')
      : compareByExpiry(getExpiryInfo(a.expiry_date, today), getExpiryInfo(b.expiry_date, today)),
  );
}
