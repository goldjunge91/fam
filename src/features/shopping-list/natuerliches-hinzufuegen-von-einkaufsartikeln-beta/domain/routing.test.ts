import type { ShoppingListCatalogEntry } from './routing';
import { routeShoppingItem } from './routing';

const lists: readonly ShoppingListCatalogEntry[] = [
  { listId: 'rewe-list', listName: 'REWE', knownBrands: ['JA'] },
  { listId: 'aldi-list', listName: 'Aldi', knownBrands: ['Gut & Günstig'] },
];

describe('routeShoppingItem', () => {
  it('routes a known brand to its unique household list', () => {
    const result = routeShoppingItem({
      item: { name: 'Skyr', quantity: 4, unit: null, brand: 'JA' },
      lists,
      learningRules: [],
      confirmations: [],
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'resolved',
        listId: 'rewe-list',
        confidence: expect.any(Number),
        needsClarification: false,
      }),
    );
  });

  it('keeps an unknown mapping uncertain and exposes alternatives', () => {
    const result = routeShoppingItem({
      item: { name: 'Brot', quantity: 1, unit: null, brand: null },
      lists,
      learningRules: [],
      confirmations: [],
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'uncertain',
        listId: null,
        bestMatch: expect.objectContaining({ listId: 'rewe-list' }),
        needsClarification: true,
        suggestions: expect.arrayContaining([
          expect.objectContaining({ listId: 'rewe-list' }),
          expect.objectContaining({ listId: 'aldi-list' }),
        ]),
      }),
    );
  });
});
