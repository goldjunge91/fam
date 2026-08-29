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

  it('addiert gleiche Artikel, hält aber unterschiedliche MHD-Lose getrennt', () => {
    const result = selectVisibleInventoryItems(
      [
        item({ id: 'i-milch-1', name: 'Milch', quantity: 2, unit: 'l', expiry_date: '2026-09-03' }),
        item({
          id: 'i-milch-2',
          name: ' milch ',
          quantity: 1,
          unit: 'l',
          expiry_date: '2026-09-12',
        }),
      ],
      BASE,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ name: 'Milch', quantity: 3, unit: 'l', expiry_date: '2026-09-03' }),
    );
    expect(result[0]?.lots.map((lot) => lot.expiry_date)).toEqual(['2026-09-03', '2026-09-12']);
  });

  it('zeigt eine Gruppe im Ablauf-Filter, wenn nur eines ihrer Lose abläuft', () => {
    const result = selectVisibleInventoryItems(
      [
        item({ id: 'i-milch-1', name: 'Milch', quantity: 2, unit: 'l', expiry_date: '2026-09-01' }),
        item({ id: 'i-milch-2', name: 'Milch', quantity: 1, unit: 'l', expiry_date: '2026-10-12' }),
      ],
      { ...BASE, showExpiringOnly: true },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(3);
    expect(result[0]?.lots).toHaveLength(2);
  });
});
