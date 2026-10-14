import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { onOutboxChanged } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { useSyncStatus } from './use-sync-status';

jest.mock('@/lib/db/outbox', () => ({ onOutboxChanged: jest.fn() }));

describe('useSyncStatus', () => {
  let queryClient: QueryClient;
  let outboxListener: (() => void) | undefined;
  const originalOnline = onlineManager.isOnline();
  const unsubscribe = jest.fn();

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    outboxListener = undefined;
    unsubscribe.mockClear();
    jest
      .mocked(onOutboxChanged)
      .mockReset()
      .mockImplementation((listener) => {
        outboxListener = listener;
        return unsubscribe;
      });
  });

  afterEach(() => {
    queryClient.clear();
    onlineManager.setOnline(originalOnline);
  });

  it('hides status and skips outbox observation when disabled', async () => {
    const getDb = jest.fn();
    const { result, unmount } = await renderHook(() => useSyncStatus(getDb, false), { wrapper });

    expect(result.current).toEqual({ kind: 'hidden' });
    expect(getDb).not.toHaveBeenCalled();
    expect(onOutboxChanged).not.toHaveBeenCalled();
    await unmount();
  });

  it('refreshes local counts on outbox changes and ignores updates after unmount', async () => {
    onlineManager.setOnline(false);
    const getFirstAsync = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 4 })
      .mockResolvedValueOnce({ count: 1 });
    const getDb = jest.fn().mockResolvedValue({ getFirstAsync } as unknown as SqlDatabase);
    const { result, unmount } = await renderHook(() => useSyncStatus(getDb), { wrapper });

    await waitFor(() => expect(result.current).toEqual({ kind: 'offline', pendingCount: 0 }));
    expect(onOutboxChanged).toHaveBeenCalledTimes(1);

    await act(async () => {
      outboxListener?.();
    });
    await waitFor(() => expect(result.current).toEqual({ kind: 'failed', failedCount: 1 }));

    await unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    const callCountAfterUnmount = getFirstAsync.mock.calls.length;
    await act(async () => {
      outboxListener?.();
      await Promise.resolve();
    });
    expect(getFirstAsync).toHaveBeenCalledTimes(callCountAfterUnmount + 2);
  });

  it('returns hidden when online with no failed entries', async () => {
    onlineManager.setOnline(true);
    const getFirstAsync = jest.fn().mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce(null);
    const getDb = jest.fn().mockResolvedValue({ getFirstAsync } as unknown as SqlDatabase);
    const { result, unmount } = await renderHook(() => useSyncStatus(getDb), { wrapper });

    await waitFor(() => expect(result.current).toEqual({ kind: 'hidden' }));
    await unmount();
  });
});
