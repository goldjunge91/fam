import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type React from 'react';

import { useAddRecipeMutation, useDeleteRecipeMutation } from '@/features/recipes/use-recipes';
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

describe('use-recipes mutations', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockDbGetAllAsync.mockResolvedValue([]);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('erstellt ein neues Rezept und reiht es in die Outbox ein', async () => {
    const { result } = await renderHook(() => useAddRecipeMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        household_id: 'hh-1',
        title: 'Gemuesepfanne',
        instructions: 'Alles anbraten.',
        created_by: 'user-1',
      });
    });

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'recipes',
        op: 'insert',
        payload: expect.objectContaining({
          title: 'Gemuesepfanne',
        }),
      }),
    );
  });

  it('loescht ein Rezept per Soft-Delete und schreibt in Outbox', async () => {
    const { result } = await renderHook(() => useDeleteRecipeMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'rec-1', household_id: 'hh-1' });
    });

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'recipes',
        entityId: 'rec-1',
      }),
    );
  });
});
