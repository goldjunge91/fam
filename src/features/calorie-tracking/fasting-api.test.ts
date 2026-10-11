import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { createElement } from 'react';
import type { FastingSessionRow } from '@/features/calorie-tracking/fasting-api';
import {
  FASTING_PROTOCOL_DURATIONS,
  fastingSessionsQueryKey,
  useActiveFastingSession,
  useDeleteFastingSessionMutation,
  useEndFastMutation,
  useFastingSessions,
  useStartFastMutation,
} from '@/features/calorie-tracking/fasting-api';

type SupabaseResult<T = unknown> = {
  data: T;
  error: { message: string } | null;
};

const mockFrom = jest.fn();

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

function createBuilder<T>(result: SupabaseResult<T>) {
  const builder = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    order: jest.fn(),
    single: jest.fn().mockResolvedValue(result),
    // biome-ignore lint/suspicious/noThenProperty: Supabase's query builder is awaitable.
    then: (
      onFulfilled: (value: SupabaseResult<T>) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };

  for (const method of [
    builder.select,
    builder.insert,
    builder.update,
    builder.eq,
    builder.is,
    builder.order,
  ]) {
    method.mockReturnValue(builder);
  }

  return builder;
}

const activeSession: FastingSessionRow = {
  id: 'fast-1',
  user_id: 'user-1',
  child_profile_id: null,
  protocol: '16:8',
  target_duration_minutes: 960,
  started_at: '2026-10-10T20:00:00.000Z',
  ended_at: null,
  notes: null,
  created_at: '2026-10-10T20:00:00.000Z',
  updated_at: '2026-10-10T20:00:00.000Z',
  deleted_at: null,
};

describe('fasting-api', () => {
  it('liefert die korrekten Dauern in Minuten für Fasten-Protokolle', () => {
    expect(FASTING_PROTOCOL_DURATIONS['16:8']).toBe(960);
    expect(FASTING_PROTOCOL_DURATIONS['18:6']).toBe(1080);
    expect(FASTING_PROTOCOL_DURATIONS['20:4']).toBe(1200);
    expect(FASTING_PROTOCOL_DURATIONS.omad).toBe(1380);
  });

  it('erzeugt deterministische Query-Keys', () => {
    expect(fastingSessionsQueryKey('user-1', null)).toEqual([
      'fasting',
      'sessions',
      'user-1',
      null,
    ]);
    expect(fastingSessionsQueryKey('user-1', 'child-1')).toEqual([
      'fasting',
      'sessions',
      'user-1',
      'child-1',
    ]);
  });
});

describe('fasting session queries and mutations', () => {
  let queryClient: QueryClient;

  function Providers({ children }: React.PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
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

  it('loads only enabled sessions, with or without a child profile filter', async () => {
    const personalBuilder = createBuilder({ data: [activeSession], error: null });
    const childSession = { ...activeSession, id: 'fast-child', child_profile_id: 'child-1' };
    const childBuilder = createBuilder({ data: [childSession], error: null });
    mockFrom.mockReturnValueOnce(personalBuilder).mockReturnValueOnce(childBuilder);

    const disabled = await renderHook(() => useFastingSessions(undefined), { wrapper: Providers });
    expect(disabled.result.current.fetchStatus).toBe('idle');
    expect(mockFrom).not.toHaveBeenCalled();
    await disabled.unmount();

    const personal = await renderHook(() => useFastingSessions('user-1'), { wrapper: Providers });
    await waitFor(() => expect(personal.result.current.data).toEqual([activeSession]));
    expect(personalBuilder.is).toHaveBeenCalledWith('child_profile_id', null);
    expect(personalBuilder.order).toHaveBeenCalledWith('started_at', { ascending: false });
    await personal.unmount();

    const child = await renderHook(() => useFastingSessions('user-1', 'child-1'), {
      wrapper: Providers,
    });
    await waitFor(() => expect(child.result.current.data).toEqual([childSession]));
    expect(childBuilder.eq).toHaveBeenCalledWith('child_profile_id', 'child-1');
    await child.unmount();
  });

  it('surfaces query errors and returns the active session when one exists', async () => {
    mockFrom
      .mockReturnValueOnce(createBuilder({ data: null, error: { message: 'offline' } }))
      .mockReturnValueOnce(
        createBuilder({
          data: [{ ...activeSession, ended_at: '2026-10-10T21:00:00.000Z' }, activeSession],
          error: null,
        }),
      )
      .mockReturnValueOnce(createBuilder({ data: [], error: null }));

    const failed = await renderHook(() => useFastingSessions('user-1'), { wrapper: Providers });
    await waitFor(() => expect(failed.result.current.error?.message).toBe('offline'));
    await failed.unmount();

    const active = await renderHook(() => useActiveFastingSession('user-1'), {
      wrapper: Providers,
    });
    await waitFor(() => expect(active.result.current.data).toEqual(activeSession));
    await active.unmount();

    const empty = await renderHook(() => useActiveFastingSession('user-1'), {
      wrapper: Providers,
    });
    await waitFor(() => expect(empty.result.current.data).toBeNull());
    await empty.unmount();
  });

  it('optimistically starts a session and trims optional notes', async () => {
    const created = { ...activeSession, id: 'fast-new', notes: 'hydrate' };
    const builder = createBuilder({ data: created, error: null });
    mockFrom.mockReturnValue(builder);
    queryClient.setQueryData(fastingSessionsQueryKey('user-1'), [activeSession]);
    const hook = await renderHook(() => useStartFastMutation(), { wrapper: Providers });
    const input = {
      userId: 'user-1',
      protocol: '16:8' as const,
      targetDurationMinutes: 960,
      startedAt: activeSession.started_at,
      notes: '  hydrate  ',
    };

    await act(async () => expect(await hook.result.current.mutateAsync(input)).toEqual(created));

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        protocol: '16:8',
        target_duration_minutes: 960,
        notes: 'hydrate',
      }),
    );
    expect(queryClient.getQueryData(fastingSessionsQueryKey('user-1'))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^optimistic-/),
          notes: '  hydrate  ',
        }),
        activeSession,
      ]),
    );
    await hook.unmount();
  });

  it('rolls back a failed start and uses defaults for optional input', async () => {
    const builder = createBuilder({ data: null, error: { message: 'cannot start' } });
    mockFrom.mockReturnValue(builder);
    queryClient.setQueryData(fastingSessionsQueryKey('user-1'), [activeSession]);
    const hook = await renderHook(() => useStartFastMutation(), { wrapper: Providers });

    await act(async () => {
      await expect(
        hook.result.current.mutateAsync({
          userId: 'user-1',
          childProfileId: 'child-1',
          protocol: 'custom',
          targetDurationMinutes: 720,
          notes: '   ',
        }),
      ).rejects.toThrow('cannot start');
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ child_profile_id: 'child-1', notes: null }),
    );
    expect(queryClient.getQueryData(fastingSessionsQueryKey('user-1'))).toEqual([activeSession]);
    await hook.unmount();
  });

  it('ends a session optimistically and rolls back when the server rejects the update', async () => {
    queryClient.setQueryData(fastingSessionsQueryKey('user-1'), [activeSession]);
    const successBuilder = createBuilder({
      data: { ...activeSession, ended_at: '2026-10-11' },
      error: null,
    });
    mockFrom.mockReturnValueOnce(successBuilder);
    const end = await renderHook(() => useEndFastMutation(), { wrapper: Providers });

    await act(async () => {
      await end.result.current.mutateAsync({
        sessionId: 'fast-1',
        userId: 'user-1',
        endedAt: '2026-10-11',
      });
    });
    expect(
      queryClient.getQueryData<FastingSessionRow[]>(fastingSessionsQueryKey('user-1'))?.[0]
        ?.ended_at,
    ).toBe('2026-10-11');

    const errorBuilder = createBuilder({ data: null, error: { message: 'cannot end' } });
    mockFrom.mockReturnValueOnce(errorBuilder);
    await act(async () => {
      await expect(
        end.result.current.mutateAsync({ sessionId: 'fast-1', userId: 'user-1' }),
      ).rejects.toThrow('cannot end');
    });
    expect(
      queryClient.getQueryData<FastingSessionRow[]>(fastingSessionsQueryKey('user-1'))?.[0]
        ?.ended_at,
    ).toBe('2026-10-11');
    await end.unmount();
  });

  it('deletes sessions optimistically and restores them after a failed delete', async () => {
    queryClient.setQueryData(fastingSessionsQueryKey('user-1'), [activeSession]);
    const successBuilder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(successBuilder);
    const remove = await renderHook(() => useDeleteFastingSessionMutation(), {
      wrapper: Providers,
    });

    await act(async () => {
      await remove.result.current.mutateAsync({ sessionId: 'fast-1', userId: 'user-1' });
    });
    expect(queryClient.getQueryData(fastingSessionsQueryKey('user-1'))).toEqual([]);
    expect(successBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );

    queryClient.setQueryData(fastingSessionsQueryKey('user-1'), [activeSession]);
    const errorBuilder = createBuilder({ data: null, error: { message: 'cannot delete' } });
    mockFrom.mockReturnValueOnce(errorBuilder);
    await act(async () => {
      await expect(
        remove.result.current.mutateAsync({ sessionId: 'fast-1', userId: 'user-1' }),
      ).rejects.toThrow('cannot delete');
    });
    expect(queryClient.getQueryData(fastingSessionsQueryKey('user-1'))).toEqual([activeSession]);
    await remove.unmount();
  });
});
