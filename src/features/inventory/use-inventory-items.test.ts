import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import {
  mapFridgeItemRow,
  readFridgeItemRow,
  useInventoryItems,
} from '@/features/inventory/use-inventory-items';
import type { SqlDatabase } from '@/lib/db/types';

const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: (...args: unknown[]) => mockGetAllAsync(...args),
    getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
  }),
}));

function rawRow(overrides: Partial<Parameters<typeof mapFridgeItemRow>[0]> = {}) {
  return {
    id: 'item-1',
    household_id: 'household-1',
    location_id: 'loc-1',
    product_id: null,
    name: 'Milch',
    quantity: 1500,
    unit: 'l',
    package_size: 1000,
    package_size_unit: 'l',
    expiry_date: null,
    opened_at: null,
    vacuum_sealed: false,
    expiry_user_set: false,
    added_by: null,
    created_at: '2026-09-08T00:00:00.000Z',
    updated_at: null,
    location_kind: 'fridge',
    location_name: 'Kuehlschrank',
    ...overrides,
  };
}

describe('mapFridgeItemRow (Persistenz-/View-Grenze fridge_items)', () => {
  it('konvertiert quantity/package_size von Integer-Tausendsteln auf Dezimal (fam-lem.30.7.2)', () => {
    const item = mapFridgeItemRow(rawRow({ quantity: 1500, package_size: 500 }));

    expect(item.quantity).toBe(1.5);
    expect(item.package_size).toBe(0.5);
  });

  it('behandelt package_size: null unveraendert', () => {
    const item = mapFridgeItemRow(rawRow({ package_size: null }));

    expect(item.package_size).toBeNull();
  });

  it('reicht alle uebrigen Felder unveraendert durch und konvertiert nur quantity/package_size', () => {
    const row = rawRow();
    const item = mapFridgeItemRow(row);

    expect(item).toEqual({ ...row, quantity: 1.5, package_size: 1 });
  });

  it('konvertiert SQLite-Integer-Werte (1/0) fuer vacuum_sealed und expiry_user_set in echte Booleans', () => {
    const itemWithOnes = mapFridgeItemRow(
      rawRow({
        vacuum_sealed: 1 as unknown as boolean,
        expiry_user_set: 1 as unknown as boolean,
      }),
    );
    expect(itemWithOnes.vacuum_sealed).toBe(true);
    expect(itemWithOnes.expiry_user_set).toBe(true);

    const itemWithZeros = mapFridgeItemRow(
      rawRow({
        vacuum_sealed: 0 as unknown as boolean,
        expiry_user_set: 0 as unknown as boolean,
      }),
    );
    expect(itemWithZeros.vacuum_sealed).toBe(false);
    expect(itemWithZeros.expiry_user_set).toBe(false);
  });
});

describe('readFridgeItemRow and useInventoryItems', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirstAsync.mockResolvedValue(null);
    mockGetAllAsync.mockResolvedValue([]);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
  });

  afterEach(() => queryClient.clear());

  it('returns null when the local database has no row for an item', async () => {
    const database = { getFirstAsync: mockGetFirstAsync } as unknown as SqlDatabase;

    await expect(readFridgeItemRow(database, { id: 'missing' })).resolves.toBeNull();
    expect(mockGetFirstAsync).toHaveBeenCalledWith(expect.stringContaining('where fi.id = ?'), [
      'missing',
    ]);
  });

  it('applies the requested household, deleted, and opened filters before mapping the row', async () => {
    mockGetFirstAsync.mockResolvedValue(rawRow({ quantity: 2500, package_size: 750 }));
    const database = { getFirstAsync: mockGetFirstAsync } as unknown as SqlDatabase;

    const item = await readFridgeItemRow(database, {
      id: 'item-1',
      householdId: 'household-1',
      excludeDeleted: true,
      excludeOpened: true,
    });

    expect(item).toMatchObject({ quantity: 2.5, package_size: 0.75 });
    expect(mockGetFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'where fi.id = ? and fi.household_id = ? and fi.deleted_at is null and fi.opened_at is null',
      ),
      ['item-1', 'household-1'],
    );
  });

  it('loads and maps the active household items from SQLite', async () => {
    mockGetAllAsync.mockResolvedValue([rawRow(), rawRow({ id: 'item-2', quantity: 500 })]);
    const { result } = await renderHook(() => useInventoryItems('household-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((item) => item.quantity)).toEqual([1.5, 0.5]);
    expect(mockGetAllAsync).toHaveBeenCalledWith(expect.stringContaining('fi.household_id = ?'), [
      'household-1',
    ]);
  });

  it('returns an empty result when explicitly refreshed without an active household', async () => {
    const { result } = await renderHook(() => useInventoryItems(undefined), { wrapper });
    let data: typeof result.current.data;

    await act(async () => {
      data = (await result.current.refetch()).data;
    });

    expect(data).toEqual([]);
    expect(mockGetAllAsync).not.toHaveBeenCalled();
  });
});
