import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type React from 'react';

import {
  useAddStorageLocationMutation,
  useDeleteStorageLocationMutation,
} from '@/features/inventory/use-storage-locations';
import { enqueueMutation } from '@/lib/db/outbox';

const mockDbRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
const mockDbGetAllAsync = jest.fn().mockResolvedValue([]);

jest.mock('@/lib/db/client', () => ({
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
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('führt useAddStorageLocationMutation über Outbox aus', async () => {
    const { result } = await renderHook(() => useAddStorageLocationMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        household_id: 'hh-1',
        name: 'Keller',
        kind: 'custom',
      });
    });

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'storage_locations',
        op: 'insert',
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

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'storage_locations',
        entityId: 'loc-1',
      }),
    );
  });
});
