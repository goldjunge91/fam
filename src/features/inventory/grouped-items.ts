import { compareByExpiry, type ExpiryInfo, getExpiryInfo } from './expiry';
import type { LocalInventoryItem } from './use-inventory-items';

export type InventoryItemGroup = {
  id: string;
  name: string;
  product_id: string | null;
  quantity: number;
  unit: string;
  package_size: number | null;
  package_size_unit: string | null;
  expiry_date: string | null;
  expiry: ExpiryInfo;
  lots: LocalInventoryItem[];
};

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
}

function groupKey(item: LocalInventoryItem): string {
  const identity = item.product_id ?? `name:${normalizeName(item.name)}`;
  return [identity, item.unit, item.package_size ?? '', item.package_size_unit ?? ''].join('|');
}

function earliestLot(lots: LocalInventoryItem[], today: Date): LocalInventoryItem | null {
  return lots.reduce<LocalInventoryItem | null>((earliest, lot) => {
    if (!earliest) return lot;
    return compareByExpiry(
      getExpiryInfo(lot.expiry_date, today),
      getExpiryInfo(earliest.expiry_date, today),
    ) < 0
      ? lot
      : earliest;
  }, null);
}

export function groupInventoryItems(
  items: LocalInventoryItem[],
  today = new Date(),
): InventoryItemGroup[] {
  const groups = new Map<string, LocalInventoryItem[]>();

  for (const item of items) {
    const key = groupKey(item);
    const lots = groups.get(key);
    if (lots) lots.push(item);
    else groups.set(key, [item]);
  }

  return [...groups.entries()].map(([id, unsortedLots]) => {
    const lots = [...unsortedLots].sort((a, b) =>
      compareByExpiry(getExpiryInfo(a.expiry_date, today), getExpiryInfo(b.expiry_date, today)),
    );
    const first = lots[0];
    const earliest = earliestLot(lots, today) ?? first;

    return {
      id,
      name: first.name,
      product_id: first.product_id,
      quantity: lots.reduce((sum, lot) => sum + lot.quantity, 0),
      unit: first.unit,
      package_size: first.package_size,
      package_size_unit: first.package_size_unit,
      expiry_date: earliest.expiry_date,
      expiry: getExpiryInfo(earliest.expiry_date, today),
      lots,
    };
  });
}
