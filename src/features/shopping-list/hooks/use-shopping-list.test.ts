import {
  groupByCategory,
  type LocalShoppingItem,
} from '@/features/shopping-list/hooks/use-shopping-list';

describe('use-shopping-list', () => {
  describe('groupByCategory', () => {
    it('gruppiert Artikel nach Kategorien und sortiert Gruppen nach definierter Reihenfolge', () => {
      const items: LocalShoppingItem[] = [
        {
          id: 'item-1',
          household_id: 'hh-1',
          product_id: null,
          name: 'Apfel',
          quantity: 3,
          unit: 'stk',
          package_size: null,
          package_size_unit: null,
          category: 'Obst & Gemüse',
          store_id: null,
          price_estimate: null,
          recipe_names: [],
          checked_at: null,
          checked_by: null,
          sort_index: 0,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'item-2',
          household_id: 'hh-1',
          product_id: null,
          name: 'Milch',
          quantity: 1,
          unit: 'l',
          package_size: null,
          package_size_unit: null,
          category: 'Milchprodukte & Eier',
          store_id: null,
          price_estimate: null,
          recipe_names: [],
          checked_at: null,
          checked_by: null,
          sort_index: 0,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'item-3',
          household_id: 'hh-1',
          product_id: null,
          name: 'Birne',
          quantity: 2,
          unit: 'stk',
          package_size: null,
          package_size_unit: null,
          category: 'Obst & Gemüse',
          store_id: null,
          price_estimate: null,
          recipe_names: [],
          checked_at: null,
          checked_by: null,
          sort_index: 1,
          created_at: '',
          updated_at: '',
        },
      ];

      const groups = groupByCategory(items);

      expect(groups).toHaveLength(2);
      expect(groups[0].category).toBe('Obst & Gemüse');
      expect(groups[0].items).toHaveLength(2);
      expect(groups[1].category).toBe('Milchprodukte & Eier');
      expect(groups[1].items).toHaveLength(1);
    });

    it('weist unkategorisierte Artikel der Sonstiges-Gruppe zu', () => {
      const items: LocalShoppingItem[] = [
        {
          id: 'item-1',
          household_id: 'hh-1',
          product_id: null,
          name: 'Sonderartikel',
          quantity: 1,
          unit: 'stk',
          package_size: null,
          package_size_unit: null,
          category: null,
          store_id: null,
          price_estimate: null,
          recipe_names: [],
          checked_at: null,
          checked_by: null,
          sort_index: 0,
          created_at: '',
          updated_at: '',
        },
      ];

      const groups = groupByCategory(items);

      expect(groups).toHaveLength(1);
      expect(groups[0].category).toBe('Sonstiges');
    });
  });
});
