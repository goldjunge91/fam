import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import {
  useAddStorageLocationMutation,
  useDeleteStorageLocationMutation,
  useStorageLocations,
  useUpdateStorageLocationMutation,
} from '@/features/inventory/use-storage-locations';
import { enqueueMutation } from '@/lib/db/outbox';

const mockDbRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
const mockDbGetAllAsync = jest.fn().mockResolvedValue([]);

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: (...args: unknown[]) => mockDbRunAsync(...args),
    getAllAsync: (...args: unknown[]) => mockDbGetAllAsync(...args),
  }),
}));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: jest.fn().mockResolvedValue(undefined),
}));

describe('use-storage-locations mutations', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    onlineManager.setOnline(true);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it('liest vorhandene Lagerorte auch offline aus SQLite', async () => {
    mockDbGetAllAsync.mockResolvedValue([
      { id: 'loc-1', household_id: 'hh-1', name: 'Vorratsschrank', kind: 'pantry', sort_order: 0 },
    ]);
    onlineManager.setOnline(false);

    const { result } = await renderHook(() => useStorageLocations('hh-1'), { wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.name).toBe('Vorratsschrank'));
    expect(mockDbGetAllAsync).toHaveBeenCalledTimes(1);
  });

  it('liefert ohne Household-ID eine leere Liste und fragt SQLite nicht ab', async () => {
    const { result } = await renderHook(() => useStorageLocations(undefined), { wrapper });

    let data: typeof result.current.data;
    await act(async () => {
      data = (await result.current.refetch()).data;
    });
    expect(data).toEqual([]);
    expect(mockDbGetAllAsync).not.toHaveBeenCalled();
  });

  it('führt useAddStorageLocationMutation über Outbox aus', async () => {
    mockDbGetAllAsync.mockResolvedValue([{ sort_order: 2 }]);
    const { result } = await renderHook(() => useAddStorageLocationMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        household_id: 'hh-1',
        name: 'Keller',
      });
    });

    // TanStack Query veroeffentlicht den sichtbaren Mutation-Status asynchron.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'storage_locations',
        op: 'insert',
        payload: expect.objectContaining({
          name: 'Keller',
          kind: 'pantry',
          sort_order: 3,
        }),
      }),
    );
  });

  it('aktualisiert den Namen eines Lagerorts als Outbox-Änderung', async () => {
    const { result } = await renderHook(() => useUpdateStorageLocationMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'loc-1', household_id: 'hh-1', name: 'Speisekammer' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'storage_locations',
        entityId: 'loc-1',
        op: 'update',
        payload: expect.objectContaining({
          id: 'loc-1',
          household_id: 'hh-1',
          name: 'Speisekammer',
        }),
      }),
    );
  });

  it('beginnt bei einem neuen Household mit Sortierreihenfolge null', async () => {
    mockDbGetAllAsync.mockResolvedValue([]);
    const { result } = await renderHook(() => useAddStorageLocationMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        household_id: 'hh-2',
        name: 'Vorrat',
        kind: 'custom',
      });
    });

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'storage_locations',
        op: 'insert',
        payload: expect.objectContaining({ name: 'Vorrat', kind: 'custom', sort_order: 0 }),
      }),
    );
  });

  it('führt useDeleteStorageLocationMutation als Soft-Delete aus', async () => {
    const { result } = await renderHook(() => useDeleteStorageLocationMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'loc-1',
        household_id: 'hh-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'storage_locations',
        entityId: 'loc-1',
      }),
    );
  });
});
