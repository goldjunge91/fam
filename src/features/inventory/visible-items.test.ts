import type { LocalInventoryItem } from './use-inventory-items';
import { selectVisibleInventoryItems } from './visible-items';

const TODAY = new Date('2026-08-29T12:00:00Z');

function item(overrides: Partial<LocalInventoryItem> & { id: string; name: string }) {
  return {
    household_id: 'hh-1',
    location_id: null,
    product_id: null,
    quantity: 1,
    unit: 'piece',
    expiry_date: null,
    added_by: null,
    created_at: '',
    location_kind: null,
    location_name: null,
    ...overrides,
  } as LocalInventoryItem;
}

const APFEL = item({ id: 'i-apfel', name: 'Apfel', expiry_date: null });
const ZWIEBEL = item({ id: 'i-zwiebel', name: 'Zwiebel', expiry_date: '2026-09-02' });

const BASE = {
  locationId: 'all',
  showExpiringOnly: false,
  searchQuery: '',
  sortMode: 'expiry' as const,
  today: TODAY,
};

describe('selectVisibleInventoryItems', () => {
  it('sortiert standardmaessig nach MHD, bald ablaufende zuerst', () => {
    const result = selectVisibleInventoryItems([APFEL, ZWIEBEL], BASE);

    expect(result.map((entry) => entry.name)).toEqual(['Zwiebel', 'Apfel']);
  });

  it('sortiert alphabetisch im Name-Modus', () => {
    const result = selectVisibleInventoryItems([APFEL, ZWIEBEL], { ...BASE, sortMode: 'name' });

    expect(result.map((entry) => entry.name)).toEqual(['Apfel', 'Zwiebel']);
  });
});
