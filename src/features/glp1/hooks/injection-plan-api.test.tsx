import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import {
  useCreateInjectionPlanMutation,
  useDeleteInjectionPlanMutation,
  useInjectionPlan,
  useUpdateInjectionPlanMutation,
} from './injection-plan-api';

type SupabaseResult = { data: unknown; error: { message: string } | null };

const mockFrom = jest.fn();

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

function createBuilder(result: SupabaseResult) {
  const builder = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    // biome-ignore lint/suspicious/noThenProperty: Awaited Supabase query builders return the supplied result.
    then: (
      onFulfilled: (value: SupabaseResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };

  for (const method of [
    builder.select,
    builder.insert,
    builder.update,
    builder.delete,
    builder.eq,
    builder.order,
    builder.limit,
  ]) {
    method.mockReturnValue(builder);
  }

  return builder;
}

describe('injection plan API', () => {
  let queryClient: QueryClient;

  function Providers({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
  });

  afterEach(() => queryClient.clear());

  it('loads and caches the latest plan for the requested account', async () => {
    const plan = { id: 'plan-1', user_id: 'user-1', medication_name: 'Ozempic' };
    const builder = createBuilder({ data: plan, error: null });
    mockFrom.mockReturnValue(builder);
    const { result, unmount } = await renderHook(() => useInjectionPlan('user-1'), {
      wrapper: Providers,
    });

    await waitFor(() => expect(result.current.data).toEqual(plan));
    expect(mockFrom).toHaveBeenCalledWith('injection_plans');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(1);
    await unmount();
  });

  it('creates, updates, and deletes plans while invalidating that account cache', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const created = { id: 'plan-1', user_id: 'user-1' };
    const createBuilderResult = createBuilder({ data: created, error: null });
    const updateBuilderResult = createBuilder({ data: created, error: null });
    const deleteBuilderResult = createBuilder({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(createBuilderResult)
      .mockReturnValueOnce(updateBuilderResult)
      .mockReturnValueOnce(deleteBuilderResult);

    const create = await renderHook(() => useCreateInjectionPlanMutation(), { wrapper: Providers });
    const update = await renderHook(() => useUpdateInjectionPlanMutation(), { wrapper: Providers });
    const remove = await renderHook(() => useDeleteInjectionPlanMutation(), { wrapper: Providers });
    const input = {
      userId: 'user-1',
      medicationName: ' Ozempic ',
      dose: 0.5,
      unit: 'mg',
      cadenceDays: 7,
      anchorAt: '2026-08-18T08:00:00.000Z',
      reminderEnabled: true,
    } as const;

    await act(async () => {
      await create.result.current.mutateAsync(input);
      await update.result.current.mutateAsync({ ...input, id: 'plan-1' });
      await remove.result.current.mutateAsync({ id: 'plan-1', userId: 'user-1' });
    });

    expect(createBuilderResult.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', medication_name: 'Ozempic', dose: 0.5 }),
    );
    expect(updateBuilderResult.eq).toHaveBeenNthCalledWith(1, 'id', 'plan-1');
    expect(updateBuilderResult.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
    expect(deleteBuilderResult.eq).toHaveBeenNthCalledWith(1, 'id', 'plan-1');
    expect(deleteBuilderResult.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['glp1', 'injection-plan', 'user-1'] });
    await create.unmount();
    await update.unmount();
    await remove.unmount();
  });

  it('surfaces backend errors from each plan mutation', async () => {
    const failedCreate = createBuilder({ data: null, error: { message: 'Create failed' } });
    const failedUpdate = createBuilder({ data: null, error: { message: 'Update failed' } });
    const failedDelete = createBuilder({ data: null, error: { message: 'Delete failed' } });
    mockFrom
      .mockReturnValueOnce(failedCreate)
      .mockReturnValueOnce(failedUpdate)
      .mockReturnValueOnce(failedDelete);

    const create = await renderHook(() => useCreateInjectionPlanMutation(), { wrapper: Providers });
    const update = await renderHook(() => useUpdateInjectionPlanMutation(), { wrapper: Providers });
    const remove = await renderHook(() => useDeleteInjectionPlanMutation(), { wrapper: Providers });
    const input = {
      userId: 'user-1',
      medicationName: 'Ozempic',
      dose: 0.5,
      unit: 'mg',
      cadenceDays: 7,
      anchorAt: '2026-08-18T08:00:00.000Z',
      reminderEnabled: true,
    } as const;

    const errors: string[] = [];
    await act(async () => {
      for (const mutate of [
        () => create.result.current.mutateAsync(input),
        () => update.result.current.mutateAsync({ ...input, id: 'plan-1' }),
        () => remove.result.current.mutateAsync({ id: 'plan-1', userId: 'user-1' }),
      ]) {
        try {
          await mutate();
        } catch (error) {
          if (error instanceof Error) errors.push(error.message);
        }
      }
    });
    expect(errors).toEqual(['Create failed', 'Update failed', 'Delete failed']);

    await create.unmount();
    await update.unmount();
    await remove.unmount();
  });

  it('keeps queries disabled without an account and surfaces backend errors', async () => {
    const disabledQuery = await renderHook(() => useInjectionPlan(undefined), {
      wrapper: Providers,
    });
    expect(mockFrom).not.toHaveBeenCalled();
    await disabledQuery.unmount();

    const failedBuilder = createBuilder({ data: null, error: { message: 'Plan unavailable' } });
    mockFrom.mockReturnValue(failedBuilder);
    const failedQuery = await renderHook(() => useInjectionPlan('user-2'), {
      wrapper: Providers,
    });
    await waitFor(() =>
      expect(failedQuery.result.current?.error?.message).toBe('Plan unavailable'),
    );
    await failedQuery.unmount();
  });
});
