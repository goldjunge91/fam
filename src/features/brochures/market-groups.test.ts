import { describe, expect, it } from '@jest/globals';
import { getBrochureMarketGroupId, groupBrochureStores } from './market-groups';
import type { LocalBrochureStore } from './types';

function store(id: string, name: string): LocalBrochureStore {
  return { id, name, logoUrl: null, active: true };
}

describe('brochure market groups', () => {
  it('classifies stores by exact normalized tokens and applies home-improvement priority', () => {
    expect(getBrochureMarketGroupId(store('obi', 'OBI Baumarkt'))).toBe('home-improvement');
    expect(getBrochureMarketGroupId(store('dm', 'dm-drogerie'))).toBe('drugstore');
    expect(getBrochureMarketGroupId(store('rewe', 'REWE Markt'))).toBe('groceries');
    expect(getBrochureMarketGroupId(store('unbekannt', 'Lokaler Laden'))).toBe('other');
    expect(getBrochureMarketGroupId(store('sonst', 'Müller & Söhne'))).toBe('drugstore');
    expect(getBrochureMarketGroupId(store('markt', 'Obi Rewe'))).toBe('home-improvement');
    expect(getBrochureMarketGroupId(store('obituary', 'Dometic Markt'))).toBe('other');
  });

  it('returns only populated groups in their declared order and keeps store identities', () => {
    const stores = [
      store('other', 'Unabhängiger Laden'),
      store('rewe', 'REWE'),
      store('dm', 'dm'),
      store('obi', 'OBI'),
    ];

    expect(groupBrochureStores(stores)).toEqual([
      { id: 'groceries', stores: [stores[1]] },
      { id: 'drugstore', stores: [stores[2]] },
      { id: 'home-improvement', stores: [stores[3]] },
      { id: 'other', stores: [stores[0]] },
    ]);
    expect(groupBrochureStores([])).toEqual([]);
  });
});
