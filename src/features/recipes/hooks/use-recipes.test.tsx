import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import {
  useAddRecipeMutation,
  useDeleteRecipeMutation,
} from '@/features/recipes/hooks/use-recipes';
import { enqueueMutation } from '@/lib/db/outbox';

const mockDbRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
const mockDbGetAllAsync = jest.fn().mockResolvedValue([]);

jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

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
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
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

    // TanStack Query veroeffentlicht den finalen Mutation-Status in einem spaeteren Tick.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

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

    // Erst nach diesem sichtbaren Hook-Zustand ist die Mutation vollstaendig abgeschlossen.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'recipes',
        entityId: 'rec-1',
      }),
    );
  });
});
