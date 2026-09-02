import {
  type InventoryContextRow,
  mapInventoryRowsToContextLots,
} from '@/features/ai-agent-skills/data/inventory-context-repository';

const row = (overrides: Partial<InventoryContextRow> = {}): InventoryContextRow => ({
  id: 'lot-1',
  householdId: 'household-1',
  productId: 'product-1',
  name: 'Milch',
  quantity: 1,
  unit: 'l',
  expiryDate: '2026-09-04',
  deletedAt: null,
  locationKind: 'fridge',
  offCategoryTags: '["de:milchprodukte"]',
  ...overrides,
});

describe('mapInventoryRowsToContextLots', () => {
  it('derives perishability from explicit product taxonomy tags', () => {
    expect(mapInventoryRowsToContextLots([row()])[0]).toMatchObject({
      id: 'lot-1',
      perishability: 'perishable',
      locationKind: 'fridge',
      useByDate: null,
    });
  });

  it('maps unknown or malformed taxonomy to unknown instead of guessing', () => {
    const [unknown, malformed] = mapInventoryRowsToContextLots([
      row({ offCategoryTags: '[]' }),
      row({ id: 'lot-2', offCategoryTags: '{not-json}' }),
    ]);

    expect(unknown?.perishability).toBe('unknown');
    expect(malformed?.perishability).toBe('unknown');
  });

  it('normalizes unsupported storage kinds to unknown', () => {
    expect(mapInventoryRowsToContextLots([row({ locationKind: 'custom' })])[0]?.locationKind).toBe(
      'unknown',
    );
  });
});
