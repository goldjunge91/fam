import { findStoreByName } from '@/features/shopping-list/hooks/use-stores';

describe('use-stores', () => {
  describe('findStoreByName', () => {
    it('findet einen Store unabhängig von Groß-/Kleinschreibung und Leerzeichen', () => {
      const stores = [
        {
          id: 'store-1',
          household_id: 'hh-1',
          name: 'Rewe Center',
          color: '#E53E3E',
          sort_order: 0,
          category_order: null,
        },
        {
          id: 'store-2',
          household_id: 'hh-1',
          name: 'Aldi Süd',
          color: '#3182CE',
          sort_order: 1,
          category_order: null,
        },
      ];

      expect(findStoreByName(stores, 'rewe center')?.id).toBe('store-1');
      expect(findStoreByName(stores, '  ALDI SÜD  ')?.id).toBe('store-2');
      expect(findStoreByName(stores, 'Lidl')).toBeUndefined();
    });
  });
});
