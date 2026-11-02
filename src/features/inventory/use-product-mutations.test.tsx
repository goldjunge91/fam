import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';
import type React from 'react';

import { getDatabase } from '@/lib/db/local-client';
import { enqueueMutation } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import { type NewProduct, useAddProductMutation } from './use-product-mutations';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/db/outbox', () => ({ enqueueMutation: jest.fn().mockResolvedValue(undefined) }));

jest.mock('@/lib/sync/mirror-write', () => ({
  applyLocalMirrorWrite: jest.fn().mockResolvedValue(undefined),
}));

describe('useAddProductMutation', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Crypto.randomUUID).mockReturnValue('product-id');
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
  });

  beforeAll(() => notifyManager.setScheduler((notify) => notify()));

  afterAll(() => notifyManager.setScheduler((notify) => setTimeout(notify, 0)));

  afterEach(() => queryClient.clear());

  it('adds a manually entered product with nullable nutrition fields and queues its local write', async () => {
    const product: NewProduct = { name: 'Haferdrink', source: 'manual', created_by: 'actor-1' };
    const { result } = await renderHook(() => useAddProductMutation(), { wrapper });

    let addedProduct: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      addedProduct = await result.current.mutateAsync(product);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getDatabase).toHaveBeenCalledTimes(1);
    expect(addedProduct).toEqual({
      id: 'product-id',
      barcode: null,
      name: 'Haferdrink',
      brand: null,
      kcal_per_100: null,
      protein_g_per_100: null,
      carbs_g_per_100: null,
      fat_g_per_100: null,
      fiber_g_per_100: null,
      sugar_g_per_100: null,
      salt_g_per_100: null,
      serving_size_g: null,
      source: 'manual',
      created_by: 'actor-1',
    });

    expect(enqueueMutation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        entity: 'products',
        entityId: 'product-id',
        op: 'insert',
        payload: expect.objectContaining({
          id: 'product-id',
          name: 'Haferdrink',
          barcode: null,
          brand: null,
          kcal_per_100: null,
          created_by: 'actor-1',
          created_at: expect.any(String),
          updated_at: expect.any(String),
        }),
        applyLocally: expect.any(Function),
      }),
    );

    const input = jest.mocked(enqueueMutation).mock.calls[0]?.[1];
    if (!input) throw new Error('Expected an enqueued product mutation.');
    const transaction = {} as SqlDatabase;
    await input.applyLocally(transaction);
    expect(applyLocalMirrorWrite).toHaveBeenCalledWith(
      transaction,
      'products',
      'insert',
      expect.objectContaining({
        id: 'product-id',
        name: 'Haferdrink',
        created_at: expect.any(String),
      }),
      expect.any(Number),
    );
  });

  it('preserves provided catalog and nutrition data', async () => {
    const product: NewProduct = {
      barcode: '4000000000012',
      name: 'Haferdrink',
      brand: 'Morgen',
      kcal_per_100: 46,
      protein_g_per_100: 1.1,
      carbs_g_per_100: 6.2,
      fat_g_per_100: 1.5,
      fiber_g_per_100: 0.8,
      sugar_g_per_100: 3.4,
      salt_g_per_100: 0.1,
      serving_size_g: 250,
      source: 'off',
      created_by: 'actor-1',
    };
    const { result } = await renderHook(() => useAddProductMutation(), { wrapper });

    let addedProduct: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      addedProduct = await result.current.mutateAsync(product);
    });

    expect(addedProduct).toMatchObject(product);
    expect(enqueueMutation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        payload: expect.objectContaining(product),
      }),
    );
  });
});
