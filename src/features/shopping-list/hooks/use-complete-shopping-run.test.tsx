import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { celebrate } from '@/features/gamification/celebration';
import { recordActivity } from '@/features/gamification/streak';
import { useCompleteShoppingRun } from '@/features/shopping-list/hooks/use-complete-shopping-run';
import type { LocalShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list';
import type { TransferItem } from '@/features/shopping-list/sheets/complete-run-sheet';
import type { EnqueueMutationInput, EnqueueMutationStepBuilder } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'generated-id') }));

// `useStorageLocations` erwartet immer eine Liste; `undefined` ist fuer TanStack Query ungueltig.
const mockDbGetAllAsync = jest.fn().mockResolvedValue([]);
const mockDbRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
const mockQueuedMutations: EnqueueMutationInput[] = [];
const mockLocalTxn: SqlDatabase = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
  getAllAsync: async <T,>() => (await mockDbGetAllAsync()) as T[],
  getFirstAsync: async () => null,
  withExclusiveTransactionAsync: jest.fn().mockResolvedValue(undefined),
};
const mockEnqueueMutationStepsInExclusiveTransaction = jest.fn(
  async (_db: SqlDatabase, build: EnqueueMutationStepBuilder) => {
    await build(mockLocalTxn, async (input) => {
      mockQueuedMutations.push(input);
    });
  },
);

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: (...args: unknown[]) => mockDbGetAllAsync(...args),
    runAsync: (...args: unknown[]) => mockDbRunAsync(...args),
  }),
}));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutationStepsInExclusiveTransaction: (
    db: SqlDatabase,
    build: EnqueueMutationStepBuilder,
  ) => mockEnqueueMutationStepsInExclusiveTransaction(db, build),
}));

jest.mock('@/lib/sync/mirror-write', () => ({
  applyLocalMirrorWrite: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/gamification/streak', () => ({
  recordActivity: jest.fn(() => ({ count: 1, increased: true, milestone: false })),
}));

jest.mock('@/features/gamification/celebration', () => ({
  celebrate: jest.fn(),
}));

jest.mock('@/features/inventory/use-storage-locations', () => ({
  useStorageLocations: () => ({ data: [{ id: 'fridge-location', kind: 'fridge' }] }),
}));

type ShoppingRunInput = {
  householdId: string;
  userId: string | null;
  checkedItems: LocalShoppingItem[];
  transfers: TransferItem[];
};

type InvalidInputCase = {
  name: string;
  error: string;
  householdId?: string;
  itemOverrides?: Partial<LocalShoppingItem>;
  transferOverrides?: Partial<TransferItem>;
  omitTransfer?: boolean;
};

const invalidInputCases: InvalidInputCase[] = [
  { name: 'rejects a missing household', error: 'Haushalt', householdId: '  ' },
  { name: 'rejects a missing item id', error: 'passen', itemOverrides: { id: '' } },
  {
    name: 'rejects an item from another household',
    error: 'passen',
    itemOverrides: { household_id: 'hh-2' },
  },
  {
    name: 'rejects an unchecked item',
    error: 'passen',
    itemOverrides: { checked_at: null },
  },
  {
    name: 'requires a transfer for each checked item',
    error: 'genau ein Transfer',
    omitTransfer: true,
  },
  {
    name: 'rejects a transfer for another product',
    error: 'Transferinhalt',
    transferOverrides: { productId: 'other-product' },
  },
  {
    name: 'rejects a transfer with a changed name',
    error: 'Transferinhalt',
    transferOverrides: { name: 'Andere Ware' },
  },
  {
    name: 'rejects a transfer with a changed unit',
    error: 'Transferinhalt',
    transferOverrides: { unit: 'kg' },
  },
  {
    name: 'rejects a transfer with a changed package size',
    error: 'Transferinhalt',
    transferOverrides: { packageSize: 2 },
  },
  {
    name: 'rejects a transfer with a changed package unit',
    error: 'Transferinhalt',
    transferOverrides: { packageSizeUnit: 'g' },
  },
  {
    name: 'rejects a non-finite transfer quantity',
    error: 'positive Menge',
    transferOverrides: { quantity: Number.NaN },
  },
  {
    name: 'rejects a quantity below one inventory unit',
    error: 'Nachkommastellen',
    transferOverrides: { quantity: 0.0001 },
  },
  {
    name: 'rejects a package size without its unit',
    error: 'gemeinsam gültig',
    itemOverrides: { package_size_unit: 'g' },
  },
  {
    name: 'rejects a non-positive package size',
    error: 'gemeinsam gültig',
    itemOverrides: { package_size: 0, package_size_unit: 'g' },
  },
  {
    name: 'rejects a blank package-size unit',
    error: 'gemeinsam gültig',
    itemOverrides: { package_size: 1, package_size_unit: '  ' },
  },
  {
    name: 'rejects a malformed expiry date',
    error: 'Mindesthaltbarkeitsdatum',
    transferOverrides: { expiryDate: '2026-2-3' },
  },
  {
    name: 'rejects an impossible expiry date',
    error: 'Mindesthaltbarkeitsdatum',
    transferOverrides: { expiryDate: '2026-02-30' },
  },
  {
    name: 'rejects an unknown storage location kind',
    error: 'Lagerort',
    transferOverrides: { locationKind: 'garage' as TransferItem['locationKind'] },
  },
];

describe('useCompleteShoppingRun', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  async function mutateRun(input: ShoppingRunInput) {
    const { result, unmount } = await renderHook(() => useCompleteShoppingRun('hh-1'), { wrapper });
    try {
      await act(async () => {
        await result.current.mutateAsync(input);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    } catch (error) {
      await waitFor(() => expect(result.current.isError).toBe(true));
      throw error;
    } finally {
      await unmount();
      queryClient.clear();
    }
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockDbGetAllAsync.mockResolvedValue([]);
    mockQueuedMutations.length = 0;
    jest.mocked(recordActivity).mockReturnValue({ count: 1, increased: true, milestone: false });
    jest.mocked(celebrate).mockClear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
  });

  it('überträgt abgehakte Artikel in den Vorrat und schließt den Einkauf ab', async () => {
    const mockItem: LocalShoppingItem = {
      id: 'item-1',
      household_id: 'hh-1',
      product_id: 'prod-hafer',
      name: 'Hafermilch',
      quantity: 2,
      unit: 'l',
      package_size: null,
      package_size_unit: null,
      category_id: 'dairy',
      category_source: 'name_fallback',
      category_classifier_version: '2026-08-22',
      category: 'Milchprodukte & Eier',
      store_id: null,
      price_estimate: 2.49,
      recipe_names: [],
      checked_at: '2026-08-20T12:00:00Z',
      checked_by: 'user-1',
      sort_index: 0,
      created_at: '2026-08-20T12:00:00Z',
      updated_at: '2026-08-20T12:00:00Z',
    };
    mockDbGetAllAsync.mockResolvedValue([{ ...mockItem, deleted_at: null }]);

    const { result } = await renderHook(() => useCompleteShoppingRun('hh-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [mockItem],
        transfers: [
          {
            shoppingItemId: 'item-1',
            productId: 'prod-hafer',
            name: 'Hafermilch',
            quantity: 2,
            unit: 'l',
            packageSize: null,
            packageSizeUnit: null,
            locationKind: 'fridge',
            expiryDate: null,
          },
        ],
      });
    });

    // Die Mutation ist erst nach dem veroeffentlichten Hook-Status vollstaendig sichtbar.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockQueuedMutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'fridge_items',
          op: 'insert',
          payload: expect.objectContaining({
            quantity: 2000,
            opened_at: null,
            vacuum_sealed: false,
            expiry_user_set: false,
          }),
        }),
        expect.objectContaining({
          entity: 'transactions',
          op: 'insert',
          payload: expect.objectContaining({
            type: 'in',
            quantity: 2000,
            fridge_item_id: expect.any(String),
          }),
        }),
      ]),
    );
    const transferMutations = mockQueuedMutations.filter(
      ({ entity }) => entity === 'fridge_items' || entity === 'transactions',
    );
    await Promise.all(transferMutations.map((mutation) => mutation.applyLocally(mockLocalTxn)));

    const checkedMutation = mockQueuedMutations.find(
      ({ entity }) => entity === 'shopping_list_items',
    );
    if (!checkedMutation) throw new Error('Die Mutation für den abgehakten Artikel fehlt.');
    await checkedMutation.applyLocally(mockLocalTxn);

    expect(applyLocalMirrorWrite).toHaveBeenCalledTimes(4);
    expect(recordActivity).toHaveBeenCalledTimes(1);
  });

  it('erzeugt keinen Nullmengen-Zugang beim Einkaufsabschluss', async () => {
    const { result } = await renderHook(() => useCompleteShoppingRun('hh-1'), { wrapper });
    const item = createCheckedItem({ id: 'item-1', name: 'Brot', product_id: null, unit: 'piece' });

    await expect(
      act(async () =>
        result.current.mutateAsync({
          householdId: 'hh-1',
          userId: 'user-1',
          checkedItems: [item],
          transfers: [
            {
              shoppingItemId: 'item-1',
              productId: item.product_id,
              name: item.name,
              quantity: 0,
              unit: item.unit,
              packageSize: null,
              packageSizeUnit: null,
              locationKind: 'pantry',
              expiryDate: null,
            },
          ],
        }),
      ),
    ).rejects.toThrow('positive Menge');
    expect(mockEnqueueMutationStepsInExclusiveTransaction).not.toHaveBeenCalled();
  });

  it('validiert gemischte Transfers vor dem ersten Bestandszugang', async () => {
    const { result } = await renderHook(() => useCompleteShoppingRun('hh-1'), { wrapper });
    const bread = createCheckedItem({
      id: 'item-1',
      name: 'Brot',
      product_id: null,
      unit: 'piece',
    });
    const milk = createCheckedItem({ id: 'item-2', name: 'Milch', product_id: null, unit: 'l' });

    await expect(
      act(async () =>
        result.current.mutateAsync({
          householdId: 'hh-1',
          userId: 'user-1',
          checkedItems: [bread, milk],
          transfers: [
            {
              shoppingItemId: 'item-1',
              productId: bread.product_id,
              name: bread.name,
              quantity: 1,
              unit: bread.unit,
              packageSize: null,
              packageSizeUnit: null,
              locationKind: 'pantry',
              expiryDate: null,
            },
            {
              shoppingItemId: 'item-2',
              productId: milk.product_id,
              name: milk.name,
              quantity: 0,
              unit: milk.unit,
              packageSize: null,
              packageSizeUnit: null,
              locationKind: 'fridge',
              expiryDate: null,
            },
          ],
        }),
      ),
    ).rejects.toThrow('positive Menge');
    expect(mockEnqueueMutationStepsInExclusiveTransaction).not.toHaveBeenCalled();
    expect(mockDbRunAsync).not.toHaveBeenCalled();
  });

  it('feiert einen erreichten Streak-Meilenstein beim Einkaufsabschluss', async () => {
    jest.mocked(recordActivity).mockReturnValue({ count: 7, increased: true, milestone: true });
    const { result } = await renderHook(() => useCompleteShoppingRun('hh-1'), { wrapper });

    const item = createCheckedItem({ id: 'item-1', name: 'Brot', product_id: null, unit: 'piece' });
    mockDbGetAllAsync.mockResolvedValue([{ ...item, deleted_at: null }]);
    await act(async () => {
      await result.current.mutateAsync({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [item],
        transfers: [createTransfer(item)],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(celebrate).toHaveBeenCalledTimes(1);
  });

  it('lässt den Einkaufsabschluss erfolgreich bleiben, wenn Haptik nicht verfügbar ist', async () => {
    jest.mocked(recordActivity).mockReturnValue({ count: 7, increased: true, milestone: true });
    jest.mocked(celebrate).mockImplementation(() => {
      throw new Error('Taptic Engine unavailable');
    });
    const { result } = await renderHook(() => useCompleteShoppingRun('hh-1'), { wrapper });

    const item = createCheckedItem({ id: 'item-1', name: 'Brot', product_id: null, unit: 'piece' });
    mockDbGetAllAsync.mockResolvedValue([{ ...item, deleted_at: null }]);
    await act(async () => {
      await result.current.mutateAsync({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [item],
        transfers: [createTransfer(item)],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it.each(invalidInputCases)('$name', async (testCase) => {
    const item = createCheckedItem(testCase.itemOverrides);
    const transfers = testCase.omitTransfer
      ? []
      : [{ ...createTransfer(item), ...testCase.transferOverrides }];

    await expect(
      mutateRun({
        householdId: testCase.householdId ?? 'hh-1',
        userId: 'user-1',
        checkedItems: [item],
        transfers,
      }),
    ).rejects.toThrow(testCase.error);

    expect(mockEnqueueMutationStepsInExclusiveTransaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate checked-item ids before writing', async () => {
    const item = createCheckedItem();

    await expect(
      mutateRun({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [item, { ...item }],
        transfers: [createTransfer(item), createTransfer(item)],
      }),
    ).rejects.toThrow('passen');
    expect(mockEnqueueMutationStepsInExclusiveTransaction).not.toHaveBeenCalled();
  });

  it('rejects a transfer whose item is not in the checked set', async () => {
    const item = createCheckedItem();

    await expect(
      mutateRun({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [item],
        transfers: [{ ...createTransfer(item), shoppingItemId: 'other-item' }],
      }),
    ).rejects.toThrow('eindeutig zugeordnet');
  });

  it('does not enqueue a second transfer when the checked item is already deleted', async () => {
    const item = createCheckedItem();
    mockDbGetAllAsync.mockResolvedValue([{ ...item, deleted_at: '2026-11-04T10:00:00Z' }]);

    await mutateRun({
      householdId: 'hh-1',
      userId: 'user-1',
      checkedItems: [item],
      transfers: [createTransfer(item)],
    });

    expect(mockQueuedMutations).toHaveLength(0);
    expect(recordActivity).not.toHaveBeenCalled();
  });

  it('rejects a checked set whose source rows changed during completion', async () => {
    const item = createCheckedItem({ id: 'item-1' });
    const second = createCheckedItem({ id: 'item-2', name: 'Milch' });
    mockDbGetAllAsync.mockResolvedValue([
      { ...item, deleted_at: null },
      { ...second, deleted_at: '2026-11-04T10:00:00Z' },
    ]);

    await expect(
      mutateRun({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [item, second],
        transfers: [createTransfer(item), createTransfer(second)],
      }),
    ).rejects.toThrow('während des Abschlusses geändert');
    expect(mockQueuedMutations).toHaveLength(0);
  });

  it('rejects source rows that disappeared or moved to another household', async () => {
    const item = createCheckedItem();
    mockDbGetAllAsync.mockResolvedValue([]);
    await expect(
      mutateRun({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [item],
        transfers: [createTransfer(item)],
      }),
    ).rejects.toThrow('nicht mehr verfügbar');

    mockDbGetAllAsync.mockResolvedValue([{ ...item, household_id: 'hh-2', deleted_at: null }]);
    await expect(
      mutateRun({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [item],
        transfers: [createTransfer(item)],
      }),
    ).rejects.toThrow('anderen Haushalt');
  });

  it('rejects invalid source quantities and changed source contents', async () => {
    const item = createCheckedItem({ quantity: 0 });
    mockDbGetAllAsync.mockResolvedValue([{ ...item, deleted_at: null }]);
    await expect(
      mutateRun({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [item],
        transfers: [createTransfer(item, 1)],
      }),
    ).rejects.toThrow('Menge eines Einkaufsartikels');

    const checkedItem = createCheckedItem();
    mockDbGetAllAsync.mockResolvedValue([{ ...checkedItem, name: 'Geändert', deleted_at: null }]);
    await expect(
      mutateRun({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [checkedItem],
        transfers: [createTransfer(checkedItem)],
      }),
    ).rejects.toThrow('während des Abschlusses geändert');
  });

  it('saves valid package metadata and leaves unknown storage locations unset', async () => {
    const item = createCheckedItem({
      product_id: 'prod-1',
      unit: 'package',
      package_size: 250,
      package_size_unit: 'g',
    });
    mockDbGetAllAsync.mockResolvedValue([{ ...item, deleted_at: null }]);
    const transfer = {
      ...createTransfer(item),
      locationKind: 'pantry' as const,
      expiryDate: '2026-11-04',
    };

    await mutateRun({
      householdId: 'hh-1',
      userId: 'user-1',
      checkedItems: [item],
      transfers: [transfer],
    });

    expect(mockQueuedMutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'fridge_items',
          payload: expect.objectContaining({
            package_size: 250_000,
            location_id: null,
            expiry_date: '2026-11-04',
          }),
        }),
      ]),
    );
  });
});

function createCheckedItem(overrides: Partial<LocalShoppingItem> = {}): LocalShoppingItem {
  return {
    id: 'item-1',
    household_id: 'hh-1',
    product_id: null,
    name: 'Brot',
    quantity: 1,
    unit: 'piece',
    package_size: null,
    package_size_unit: null,
    category_id: 'bakery',
    category_source: 'name_fallback',
    category_classifier_version: '2026-08-22',
    category: 'Brot & Backwaren',
    store_id: null,
    price_estimate: null,
    recipe_names: [],
    checked_at: '2026-08-20T12:00:00Z',
    checked_by: 'user-1',
    sort_index: 0,
    created_at: '2026-08-20T12:00:00Z',
    updated_at: '2026-08-20T12:00:00Z',
    ...overrides,
  };
}

function createTransfer(item: LocalShoppingItem, quantity = item.quantity): TransferItem {
  return {
    shoppingItemId: item.id,
    productId: item.product_id,
    name: item.name,
    quantity,
    unit: item.unit,
    packageSize: item.package_size,
    packageSizeUnit: item.package_size_unit,
    locationKind: 'fridge',
    expiryDate: null,
  };
}
