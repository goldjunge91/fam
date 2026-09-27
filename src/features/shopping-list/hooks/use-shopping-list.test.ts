import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as React from 'react';

import {
  groupByCategory,
  type LocalShoppingItem,
  useShoppingList,
} from '@/features/shopping-list/hooks/use-shopping-list';

const mockDbGetAllAsync = jest.fn();

function shoppingRow(name: string) {
  return {
    id: `item-${name.toLowerCase()}`,
    household_id: 'hh-1',
    product_id: null,
    name,
    quantity: 1,
    unit: 'l',
    package_size: null,
    package_size_unit: null,
    category_id: 'dairy',
    category_source: 'name_fallback',
    category_classifier_version: null,
    store_id: null,
    price_estimate: null,
    recipe_names: '[]',
    checked_at: null,
    checked_by: null,
    sort_index: 0,
    created_at: '',
    updated_at: '',
  };
}

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: (...args: unknown[]) => mockDbGetAllAsync(...args),
  }),
}));

describe('use-shopping-list', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    onlineManager.setOnline(true);
    mockDbGetAllAsync.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it('liest gespeicherte Einkaufslistenartikel auch offline aus SQLite', async () => {
    mockDbGetAllAsync.mockResolvedValue([shoppingRow('Milch')]);
    onlineManager.setOnline(false);

    const { result } = await renderHook(() => useShoppingList('hh-1'), { wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.items[0]?.name).toBe('Milch'));
    expect(mockDbGetAllAsync).toHaveBeenCalledTimes(1);
  });

  it('zeigt einen SQLite-Fehler offline als Fehler statt als pausierten Request', async () => {
    mockDbGetAllAsync.mockRejectedValue(new Error('SQLite nicht verfügbar'));
    onlineManager.setOnline(false);

    const { result } = await renderHook(() => useShoppingList('hh-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.error?.message).toBe('SQLite nicht verfügbar');
  });

  it('liest nach einer Sync-Invalidierung den aktualisierten lokalen Bestand neu', async () => {
    mockDbGetAllAsync
      .mockResolvedValueOnce([shoppingRow('Milch')])
      .mockResolvedValueOnce([shoppingRow('Brot')]);
    onlineManager.setOnline(false);

    const { result } = await renderHook(() => useShoppingList('hh-1'), { wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.items[0]?.name).toBe('Milch'));
    await queryClient.invalidateQueries({ queryKey: ['shopping_list_items', 'hh-1'] });

    await waitFor(() => expect(result.current.data?.[0]?.items[0]?.name).toBe('Brot'));
    expect(mockDbGetAllAsync).toHaveBeenCalledTimes(2);
  });

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
          category_id: 'produce',
          category_source: 'name_fallback',
          category_classifier_version: null,
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
          category_id: 'dairy',
          category_source: 'name_fallback',
          category_classifier_version: null,
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
          category_id: 'produce',
          category_source: 'name_fallback',
          category_classifier_version: null,
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
          category_id: null,
          category_source: null,
          category_classifier_version: null,
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
