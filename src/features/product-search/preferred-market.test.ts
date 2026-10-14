import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook } from '@testing-library/react-native';

import {
  getPreferredProductMarkets,
  preferredProductMarketQueryKey,
  setPreferredProductMarkets,
  usePreferredProductMarket,
  usePreferredProductMarketName,
  useSetPreferredProductMarket,
} from './preferred-market';

const mockUseQuery = jest.fn<unknown, [unknown]>();
const mockUseStores = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: (...args: unknown[]) => mockUseStores(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: undefined });
  mockUseStores.mockReturnValue({ data: undefined });
});

describe('preferred product markets', () => {
  it('reads a stored list and ignores values that are not strings', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('["store-a", 4, "store-b"]');

    await expect(getPreferredProductMarkets('household-1')).resolves.toEqual([
      'store-a',
      'store-b',
    ]);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(
      '@fam/product-search-preferred-market:household-1',
    );
  });

  it('handles an unset value, a legacy single ID, and invalid stored JSON', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);
    await expect(getPreferredProductMarkets('empty')).resolves.toEqual([]);

    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('store-legacy');
    await expect(getPreferredProductMarkets('legacy')).resolves.toEqual(['store-legacy']);

    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('{invalid');
    await expect(getPreferredProductMarkets('invalid')).resolves.toEqual(['{invalid']);
  });

  it('does not fail the search when local storage cannot be read or written', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('read failed'));
    await expect(getPreferredProductMarkets('household-1')).resolves.toEqual([]);

    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('write failed'));
    await expect(setPreferredProductMarkets('household-1', ['store-a'])).resolves.toBeUndefined();

    jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('remove failed'));
    await expect(setPreferredProductMarkets('household-1', [])).resolves.toBeUndefined();
  });

  it('stores a list or removes the key when the selection is cleared', async () => {
    await setPreferredProductMarkets('household-1', ['store-a', 'store-b']);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@fam/product-search-preferred-market:household-1',
      '["store-a","store-b"]',
    );

    await setPreferredProductMarkets('household-1', []);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      '@fam/product-search-preferred-market:household-1',
    );
  });

  it('builds a household-scoped query key and disables querying without a household', async () => {
    expect(preferredProductMarketQueryKey(undefined)).toEqual([
      'settings',
      'product-search-preferred-market',
      undefined,
    ]);

    mockUseQuery.mockImplementation((options: unknown) => options);
    await renderHook(() => usePreferredProductMarket(undefined));
    const options = mockUseQuery.mock.calls.at(-1)?.[0] as {
      enabled: boolean;
      queryFn: () => Promise<string[]> | string[];
    };

    expect(options.enabled).toBe(false);
    expect(options.queryFn()).toEqual([]);
  });

  it('loads a household market and invalidates the same key after changes', async () => {
    mockUseQuery.mockImplementation((options: unknown) => options);
    await renderHook(() => usePreferredProductMarket('household-1'));
    const options = mockUseQuery.mock.calls.at(-1)?.[0] as {
      enabled: boolean;
      queryFn: () => Promise<string[]>;
    };

    expect(options.enabled).toBe(true);
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('["store-a"]');
    await expect(options.queryFn()).resolves.toEqual(['store-a']);

    const { result: setResult } = await renderHook(() => useSetPreferredProductMarket());
    await setResult.current('household-1', ['store-a']);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: preferredProductMarketQueryKey('household-1'),
    });
  });
});

it('liefert bei unveränderten Daten dieselbe Markt-Referenz', async () => {
  const { result, rerender } = await renderHook(() => usePreferredProductMarketName(undefined));
  const firstResult = result.current;

  rerender(undefined);

  expect(result.current).toBe(firstResult);
});

it('mappt gespeicherte Märkte auf vorhandene Ladennamen', async () => {
  mockUseQuery.mockReturnValue({ data: ['store-a', 'missing', 'store-b'] });
  mockUseStores.mockReturnValue({
    data: [
      { id: 'store-a', name: 'Markt A' },
      { id: 'store-b', name: 'Markt B' },
    ],
  });

  const { result } = await renderHook(() => usePreferredProductMarketName('household-1'));

  expect(result.current).toEqual(['Markt A', 'Markt B']);
});
