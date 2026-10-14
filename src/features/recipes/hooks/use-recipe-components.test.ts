import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import * as React from 'react';
import type { EnqueueMutationInput } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import {
  useAddComponentMutation,
  useAddItemMutation,
  useDeleteComponentMutation,
  useDeleteItemMutation,
  useUpdateComponentMutation,
  useUpdateItemMutation,
} from './use-recipe-components';

const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockEnqueueMutation = jest.fn();
const mockApplyLocalMirrorWrite = jest.mocked(applyLocalMirrorWrite);

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn(async () => ({
    getAllAsync: (...args: unknown[]) => mockGetAllAsync(...args),
    getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
  })),
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'generated-recipe-id' }));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: (...args: unknown[]) => mockEnqueueMutation(...args),
}));

jest.mock('@/lib/sync/mirror-write', () => ({
  applyLocalMirrorWrite: jest.fn().mockResolvedValue(undefined),
}));

describe('recipe component mutations', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockGetAllAsync.mockReset().mockResolvedValue([]);
    mockGetFirstAsync.mockReset().mockResolvedValue(null);
    mockEnqueueMutation.mockReset().mockResolvedValue(undefined);
    mockApplyLocalMirrorWrite.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    queryClient.clear();
  });

  async function applyQueuedMutation(index = 0) {
    const input = mockEnqueueMutation.mock.calls[index]?.[1] as EnqueueMutationInput;
    const txn = {} as SqlDatabase;
    await input.applyLocally(txn);
    return { input, txn };
  }

  it('adds a component with serving size and invalidates the recipe detail', async () => {
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useAddComponentMutation(), { wrapper });

    let added: { id: string; recipe_id: string; serving_grams?: number | null } | undefined;
    await act(async () => {
      added = await result.current.mutateAsync({
        recipe_id: 'recipe-1',
        household_id: 'household-1',
        name: 'Sauce',
        serving_grams: 120,
      });
    });

    expect(added).toMatchObject({ id: 'generated-recipe-id', serving_grams: 120 });
    const { input, txn } = await applyQueuedMutation();
    expect(input).toMatchObject({
      entity: 'recipe_components',
      op: 'insert',
      payload: { recipe_id: 'recipe-1', serving_grams: 120 },
    });
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      txn,
      'recipe_components',
      'insert',
      expect.objectContaining({ name: 'Sauce', serving_grams: 120 }),
      expect.any(Number),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['recipe-detail', 'recipe-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sync-status'] });
  });

  it('updates a component and defaults a missing serving size to null', async () => {
    const { result } = await renderHook(() => useUpdateComponentMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'component-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
        name: 'Filling',
      });
    });

    const { input, txn } = await applyQueuedMutation();
    expect(input).toMatchObject({
      entity: 'recipe_components',
      entityId: 'component-1',
      op: 'update',
      payload: { name: 'Filling', serving_grams: null },
    });
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      txn,
      'recipe_components',
      'update',
      { id: 'component-1', name: 'Filling', serving_grams: null },
      expect.any(Number),
    );
  });

  it('removes a component and its active items from the local mirror', async () => {
    mockGetAllAsync.mockResolvedValue([{ id: 'component-item-1' }]);
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useDeleteComponentMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'component-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
      });
    });

    expect(mockEnqueueMutation).toHaveBeenCalledTimes(2);
    expect(
      mockEnqueueMutation.mock.calls.map(([, input]) => (input as EnqueueMutationInput).entity),
    ).toEqual(['recipe_component_items', 'recipe_components']);
    await applyQueuedMutation(0);
    await applyQueuedMutation(1);
    expect(mockApplyLocalMirrorWrite).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'recipe_component_items',
      'delete',
      { id: 'component-item-1' },
      expect.any(Number),
    );
    expect(mockApplyLocalMirrorWrite).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'recipe_components',
      'delete',
      { id: 'component-1' },
      expect.any(Number),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['recipe-detail', 'recipe-1'] });
  });

  it('refuses to delete a component that is still used as a subcomponent', async () => {
    mockGetFirstAsync.mockResolvedValue({ id: 'parent-item' });
    const { result } = await renderHook(() => useDeleteComponentMutation(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          id: 'component-1',
          recipe_id: 'recipe-1',
          household_id: 'household-1',
        });
      }),
    ).rejects.toThrow('Diese Komponente wird von einer anderen Komponente verwendet');
    expect(mockEnqueueMutation).not.toHaveBeenCalled();
  });

  it('adds component items with defaults and preserves supplied optional fields', async () => {
    const { result } = await renderHook(() => useAddItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        component_id: 'component-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
        grams: 80,
      });
      await result.current.mutateAsync({
        component_id: 'component-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
        product_id: 'product-1',
        sub_component_id: 'component-2',
        grams: 90,
        quantity: 2,
        unit: 'tbsp',
        optional: true,
        note: 'finely chopped',
      });
    });

    expect(mockEnqueueMutation).toHaveBeenCalledTimes(2);
    const defaultInput = mockEnqueueMutation.mock.calls[0]?.[1] as EnqueueMutationInput;
    expect(defaultInput.payload).toMatchObject({
      product_id: null,
      sub_component_id: null,
      grams: 80,
      quantity: null,
      unit: 'g',
      optional: false,
      note: null,
    });
    const suppliedInput = mockEnqueueMutation.mock.calls[1]?.[1] as EnqueueMutationInput;
    expect(suppliedInput.payload).toMatchObject({
      product_id: 'product-1',
      sub_component_id: 'component-2',
      quantity: 2,
      unit: 'tbsp',
      optional: true,
      note: 'finely chopped',
    });
    await applyQueuedMutation(0);
    await applyQueuedMutation(1);
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledTimes(2);
  });

  it('updates item fields and omits optional properties when they were not supplied', async () => {
    const { result } = await renderHook(() => useUpdateItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'item-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
        grams: 25,
      });
      await result.current.mutateAsync({
        id: 'item-2',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
        grams: 30,
        quantity: 1,
        unit: 'piece',
        optional: false,
        note: 'whole',
      });
    });

    const firstInput = mockEnqueueMutation.mock.calls[0]?.[1] as EnqueueMutationInput;
    expect(firstInput.payload).toMatchObject({ grams: 25, quantity: null, unit: 'g' });
    expect(firstInput.payload).not.toHaveProperty('optional');
    expect(firstInput.payload).not.toHaveProperty('note');
    const secondInput = mockEnqueueMutation.mock.calls[1]?.[1] as EnqueueMutationInput;
    expect(secondInput.payload).toMatchObject({
      grams: 30,
      quantity: 1,
      unit: 'piece',
      optional: false,
      note: 'whole',
    });
    await applyQueuedMutation(0);
    await applyQueuedMutation(1);
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledTimes(2);
  });

  it('soft-deletes an item', async () => {
    const { result } = await renderHook(() => useDeleteItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'item-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
      });
    });

    const { input, txn } = await applyQueuedMutation();
    expect(input).toMatchObject({
      entity: 'recipe_component_items',
      entityId: 'item-1',
      op: 'delete',
      payload: { household_id: 'household-1' },
    });
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      txn,
      'recipe_component_items',
      'delete',
      { id: 'item-1' },
      expect.any(Number),
    );
  });
});
