import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as React from 'react';

import {
  findStoreByName,
  useAddStoreMutation,
  useDeleteStoreMutation,
  useSetStoreCategoryOrderMutation,
  useStores,
  useUpdateStoreMutation,
} from '@/features/shopping-list/hooks/use-stores';
import type { EnqueueMutationInput } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

const mockDbGetAllAsync = jest.fn();
const mockEnqueueMutation = jest.fn();
const mockApplyLocalMirrorWrite = jest.mocked(applyLocalMirrorWrite);

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: (...args: unknown[]) => mockDbGetAllAsync(...args),
  }),
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'generated-store-id' }));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: (...args: unknown[]) => mockEnqueueMutation(...args),
}));

jest.mock('@/lib/sync/mirror-write', () => ({
  applyLocalMirrorWrite: jest.fn().mockResolvedValue(undefined),
}));

describe('use-stores', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    onlineManager.setOnline(true);
    mockDbGetAllAsync.mockReset();
    mockEnqueueMutation.mockReset().mockResolvedValue(undefined);
    mockApplyLocalMirrorWrite.mockReset().mockResolvedValue(undefined);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
  });

  afterEach(async () => {
    await act(async () => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it('zeigt gespeicherte Supermärkte auch offline aus SQLite an', async () => {
    mockDbGetAllAsync.mockResolvedValue([
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Supermarkt',
        color: 'mauve',
        sort_order: 0,
        category_order: null,
      },
    ]);
    onlineManager.setOnline(false);

    const { result } = await renderHook(() => useStores('hh-1'), { wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.name).toBe('Supermarkt'));
    expect(mockDbGetAllAsync).toHaveBeenCalledTimes(1);
  });

  it('laedt Stores fuer den angefragten Haushalt in Sortierreihenfolge', async () => {
    mockDbGetAllAsync.mockResolvedValue([]);

    const { result } = await renderHook(() => useStores('hh-2'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDbGetAllAsync).toHaveBeenCalledWith(
      'select id, household_id, name, color, sort_order, category_order from stores where household_id = ? and deleted_at is null order by sort_order',
      ['hh-2'],
    );
  });

  it('legt den ersten Store an und schreibt ihn lokal in die Outbox', async () => {
    mockDbGetAllAsync.mockResolvedValue([]);
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useAddStoreMutation(), { wrapper });

    let created: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      created = await result.current.mutateAsync({
        household_id: 'hh-1',
        name: 'Supermarkt',
        color: 'mauve',
      });
    });

    expect(created).toMatchObject({
      id: 'generated-store-id',
      household_id: 'hh-1',
      name: 'Supermarkt',
      color: 'mauve',
      sort_order: 0,
    });
    const input = mockEnqueueMutation.mock.calls[0]?.[1] as EnqueueMutationInput;
    expect(input).toMatchObject({
      entity: 'stores',
      entityId: 'generated-store-id',
      op: 'insert',
      payload: { household_id: 'hh-1', sort_order: 0 },
    });
    const txn = {} as SqlDatabase;
    await input.applyLocally(txn);
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      txn,
      'stores',
      'insert',
      expect.objectContaining({ id: 'generated-store-id', sort_order: 0 }),
      expect.any(Number),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['stores', 'hh-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sync-status'] });
  });

  it('haengt einen neuen Store hinter den hoechsten Sortierwert', async () => {
    mockDbGetAllAsync.mockResolvedValue([{ sort_order: 4 }]);
    const { result } = await renderHook(() => useAddStoreMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        household_id: 'hh-1',
        name: 'Drogerie',
        color: 'sage',
      });
    });

    expect(mockEnqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ payload: expect.objectContaining({ sort_order: 5 }) }),
    );
  });

  it('aktualisiert einen Store und invalidiert Store- und Sync-Abfragen', async () => {
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useUpdateStoreMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Neuer Name',
        color: 'sage',
      });
    });

    const input = mockEnqueueMutation.mock.calls[0]?.[1] as EnqueueMutationInput;
    expect(input).toMatchObject({
      entityId: 'store-1',
      op: 'update',
      payload: { household_id: 'hh-1', name: 'Neuer Name', color: 'sage' },
    });
    const txn = {} as SqlDatabase;
    await input.applyLocally(txn);
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      txn,
      'stores',
      'update',
      { id: 'store-1', name: 'Neuer Name', color: 'sage' },
      expect.any(Number),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['stores', 'hh-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sync-status'] });
  });

  it('speichert die normalisierte Kategorie-Reihenfolge', async () => {
    const { result } = await renderHook(() => useSetStoreCategoryOrderMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'store-1',
        household_id: 'hh-1',
        categoryOrder: ['frozen', 'fresh_produce', 'frozen'],
      });
    });

    const input = mockEnqueueMutation.mock.calls[0]?.[1] as EnqueueMutationInput;
    expect(input.entityId).toBe('store-1');
    expect(input.op).toBe('update');
    expect(input.payload.household_id).toBe('hh-1');
    const serializedOrder = input.payload.category_order as string;
    const serializedIds = serializedOrder.split(',');
    expect(serializedIds.slice(0, 2)).toEqual(['frozen', 'fresh_produce']);
    expect(new Set(serializedIds).size).toBe(serializedIds.length);
    const txn = {} as SqlDatabase;
    await input.applyLocally(txn);
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      txn,
      'stores',
      'update',
      { id: 'store-1', category_order: serializedOrder },
      expect.any(Number),
    );
  });

  it('soft-deletet einen Store und invalidiert Store- und Sync-Abfragen', async () => {
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useDeleteStoreMutation(), { wrapper });

    let deleted: string | undefined;
    await act(async () => {
      deleted = await result.current.mutateAsync({ id: 'store-1', household_id: 'hh-1' });
    });

    expect(deleted).toBe('store-1');
    const input = mockEnqueueMutation.mock.calls[0]?.[1] as EnqueueMutationInput;
    expect(input).toMatchObject({
      entityId: 'store-1',
      op: 'delete',
      payload: { household_id: 'hh-1' },
    });
    const txn = {} as SqlDatabase;
    await input.applyLocally(txn);
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      txn,
      'stores',
      'delete',
      { id: 'store-1' },
      expect.any(Number),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['stores', 'hh-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sync-status'] });
  });

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
