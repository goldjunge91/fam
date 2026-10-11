import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import * as React from 'react';

import type { EnqueueMutationInput } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import { MAX_RECIPE_STEP_IMAGES } from '../wizard/types';
import {
  useAddStepImageMutation,
  useAddStepIngredientMutation,
  useAddStepMutation,
  useDeleteStepImageMutation,
  useDeleteStepMutation,
  useRemoveStepIngredientMutation,
  useUpdateStepImageMutation,
  useUpdateStepMutation,
} from './use-recipe-steps';

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

jest.mock('expo-crypto', () => ({ randomUUID: () => 'generated-step-id' }));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: (...args: unknown[]) => mockEnqueueMutation(...args),
}));

jest.mock('@/lib/sync/mirror-write', () => ({
  applyLocalMirrorWrite: jest.fn().mockResolvedValue(undefined),
}));

describe('recipe step mutations', () => {
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

  async function expectMutationError(run: () => Promise<unknown>, message: string) {
    let error: unknown;
    await act(async () => {
      try {
        await run();
      } catch (caught) {
        error = caught;
      }
    });
    expect(error).toEqual(expect.objectContaining({ message: expect.stringContaining(message) }));
  }

  it('adds a step with optional image and timer values', async () => {
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useAddStepMutation(), { wrapper });

    let added: { id: string; image_path: string | null; timer_minutes: number | null } | undefined;
    await act(async () => {
      added = await result.current.mutateAsync({
        recipe_id: 'recipe-1',
        household_id: 'household-1',
        position: 2,
        text: 'Bake until golden',
        image_path: 'steps/oven.jpg',
        timer_minutes: 18,
      });
    });

    expect(added).toMatchObject({
      id: 'generated-step-id',
      image_path: 'steps/oven.jpg',
      timer_minutes: 18,
    });
    const { input, txn } = await applyQueuedMutation();
    expect(input).toMatchObject({
      entity: 'recipe_steps',
      op: 'insert',
      payload: {
        recipe_id: 'recipe-1',
        position: 2,
        text: 'Bake until golden',
        image_path: 'steps/oven.jpg',
        timer_minutes: 18,
      },
    });
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      txn,
      'recipe_steps',
      'insert',
      expect.objectContaining({ text: 'Bake until golden', timer_minutes: 18 }),
      expect.any(Number),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['recipe-detail', 'recipe-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sync-status'] });
  });

  it('defaults missing step image and timer values to null when updating', async () => {
    const { result } = await renderHook(() => useUpdateStepMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'step-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
        position: 0,
        text: 'Mix ingredients',
      });
    });

    const { input, txn } = await applyQueuedMutation();
    expect(input).toMatchObject({
      entity: 'recipe_steps',
      entityId: 'step-1',
      op: 'update',
      payload: { image_path: null, timer_minutes: null },
    });
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      txn,
      'recipe_steps',
      'update',
      expect.objectContaining({ image_path: null, timer_minutes: null }),
      expect.any(Number),
    );
  });

  it('rejects step images outside the allowed position range', async () => {
    const { result } = await renderHook(() => useAddStepImageMutation(), { wrapper });
    const common = {
      step_id: 'step-1',
      recipe_id: 'recipe-1',
      household_id: 'household-1',
      storage_path: 'steps/photo.jpg',
    };

    await expectMutationError(
      () => result.current.mutateAsync({ ...common, position: -1 }),
      'höchstens drei Bilder',
    );
    await expectMutationError(
      () => result.current.mutateAsync({ ...common, position: MAX_RECIPE_STEP_IMAGES }),
      'höchstens drei Bilder',
    );
    expect(mockGetFirstAsync).not.toHaveBeenCalled();
    expect(mockEnqueueMutation).not.toHaveBeenCalled();
  });

  it('adds an image only while the step has room for it', async () => {
    const { result } = await renderHook(() => useAddStepImageMutation(), { wrapper });
    const common = {
      step_id: 'step-1',
      recipe_id: 'recipe-1',
      household_id: 'household-1',
      storage_path: 'steps/photo.jpg',
    };
    mockGetFirstAsync.mockResolvedValue({ count: MAX_RECIPE_STEP_IMAGES });

    await expectMutationError(
      () => result.current.mutateAsync({ ...common, position: 1 }),
      'höchstens drei Bilder',
    );
    expect(mockEnqueueMutation).not.toHaveBeenCalled();

    mockGetFirstAsync.mockResolvedValue(null);
    await act(async () => {
      await result.current.mutateAsync({ ...common, position: 0 });
    });

    const { input, txn } = await applyQueuedMutation();
    expect(input).toMatchObject({
      entity: 'recipe_step_images',
      entityId: 'generated-step-id',
      op: 'insert',
      payload: { step_id: 'step-1', position: 0, storage_path: 'steps/photo.jpg' },
    });
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      txn,
      'recipe_step_images',
      'insert',
      expect.objectContaining({ step_id: 'step-1', position: 0 }),
      expect.any(Number),
    );
  });

  it('updates and soft-deletes step images', async () => {
    const { result: updateResult } = await renderHook(() => useUpdateStepImageMutation(), {
      wrapper,
    });

    await expectMutationError(
      () =>
        updateResult.current.mutateAsync({
          id: 'image-1',
          step_id: 'step-1',
          recipe_id: 'recipe-1',
          household_id: 'household-1',
          position: MAX_RECIPE_STEP_IMAGES,
        }),
      'höchstens drei Bilder',
    );
    expect(mockEnqueueMutation).not.toHaveBeenCalled();

    await act(async () => {
      await updateResult.current.mutateAsync({
        id: 'image-1',
        step_id: 'step-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
        position: 2,
      });
    });
    const update = await applyQueuedMutation();
    expect(update.input).toMatchObject({
      entity: 'recipe_step_images',
      entityId: 'image-1',
      op: 'update',
      payload: { position: 2 },
    });
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      update.txn,
      'recipe_step_images',
      'update',
      { id: 'image-1', position: 2 },
      expect.any(Number),
    );

    const { result: deleteResult } = await renderHook(() => useDeleteStepImageMutation(), {
      wrapper,
    });
    await act(async () => {
      await deleteResult.current.mutateAsync({
        id: 'image-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
      });
    });
    const deletion = await applyQueuedMutation(1);
    expect(deletion.input).toMatchObject({
      entity: 'recipe_step_images',
      entityId: 'image-1',
      op: 'delete',
      payload: { household_id: 'household-1' },
    });
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      deletion.txn,
      'recipe_step_images',
      'delete',
      { id: 'image-1' },
      expect.any(Number),
    );
  });

  it('deletes a step and queues deletion of linked images and ingredients first', async () => {
    mockGetAllAsync
      .mockResolvedValueOnce([{ id: 'ingredient-link-1' }])
      .mockResolvedValueOnce([{ id: 'image-1' }, { id: 'image-2' }]);
    const { result } = await renderHook(() => useDeleteStepMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'step-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
      });
    });

    expect(mockEnqueueMutation).toHaveBeenCalledTimes(4);
    expect(
      mockEnqueueMutation.mock.calls.map(([, input]) => (input as EnqueueMutationInput).entity),
    ).toEqual([
      'recipe_step_images',
      'recipe_step_images',
      'recipe_step_ingredients',
      'recipe_steps',
    ]);
    await applyQueuedMutation(0);
    await applyQueuedMutation(1);
    await applyQueuedMutation(2);
    await applyQueuedMutation(3);
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledTimes(4);
  });

  it('adds and removes a step ingredient', async () => {
    const { result: addResult } = await renderHook(() => useAddStepIngredientMutation(), {
      wrapper,
    });

    let added: { id: string; step_id: string; item_id: string } | undefined;
    await act(async () => {
      added = await addResult.current.mutateAsync({
        step_id: 'step-1',
        item_id: 'item-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
      });
    });

    expect(added).toMatchObject({ id: 'generated-step-id', step_id: 'step-1', item_id: 'item-1' });
    const { input, txn } = await applyQueuedMutation();
    expect(input).toMatchObject({
      entity: 'recipe_step_ingredients',
      op: 'insert',
      payload: { step_id: 'step-1', item_id: 'item-1' },
    });
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      txn,
      'recipe_step_ingredients',
      'insert',
      expect.objectContaining({ step_id: 'step-1', item_id: 'item-1' }),
      expect.any(Number),
    );

    const { result: removeResult } = await renderHook(() => useRemoveStepIngredientMutation(), {
      wrapper,
    });
    await act(async () => {
      await removeResult.current.mutateAsync({
        id: 'link-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
      });
    });
    const removal = await applyQueuedMutation(1);
    expect(removal.input).toMatchObject({
      entity: 'recipe_step_ingredients',
      entityId: 'link-1',
      op: 'delete',
      payload: { household_id: 'household-1' },
    });
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      removal.txn,
      'recipe_step_ingredients',
      'delete',
      { id: 'link-1' },
      expect.any(Number),
    );
  });
});
