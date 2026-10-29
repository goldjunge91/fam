import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { getDatabase } from '@/lib/db/local-client';
import { debugLog } from '@/lib/observability/debug-log';
import { reportError } from '@/lib/telemetry';
import { mapRegionalAvailabilityRows, writeBrochureDump } from '../brochure-sync';
import { useBrochureSync } from './use-brochure-sync';
import { useBrochureSync as useBrochureSyncAndroid } from './use-brochure-sync.android';

jest.mock('@/lib/backend/supabase/remote-client', () => ({ getSupabase: jest.fn() }));
jest.mock('@/lib/db/local-client', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/observability/debug-log', () => ({ debugLog: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({ reportError: jest.fn() }));
jest.mock('../brochure-sync', () => ({
  ...jest.requireActual<typeof import('../brochure-sync')>('../brochure-sync'),
  mapRegionalAvailabilityRows: jest.fn(),
  writeBrochureDump: jest.fn(),
}));

const mockGetSupabase = jest.mocked(getSupabase);
const mockGetDatabase = jest.mocked(getDatabase);
const mockDebugLog = jest.mocked(debugLog);
const mockReportError = jest.mocked(reportError);
const mockMapRegionalAvailabilityRows = jest.mocked(mapRegionalAvailabilityRows);
const mockWriteBrochureDump = jest.mocked(writeBrochureDump);
const mockRpc = jest.fn();
const mockChannel = {
  on: jest.fn(),
  subscribe: jest.fn(),
};
const mockCreateChannel = jest.fn(() => mockChannel);
const mockRemoveChannel = jest.fn();
let mockBroadcastHandler: ((message: { payload: Record<string, unknown> }) => void) | undefined;
const mockEq = jest.fn(
  async (
    _column: string,
    _zipCode: string,
  ): Promise<{ data: unknown[] | null; error: unknown }> => ({
    data: [],
    error: null,
  }),
);

const hookVariants: readonly (readonly [string, typeof useBrochureSync])[] = [
  ['shared', useBrochureSync],
  ['Android', useBrochureSyncAndroid],
];

function queryClientWrapper(queryClient: QueryClient) {
  return function QueryClientTestWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  mockBroadcastHandler = undefined;
  mockChannel.on.mockReset();
  mockChannel.on.mockImplementation(
    (
      _event: string,
      _filter: unknown,
      handler: (message: { payload: Record<string, unknown> }) => void,
    ) => {
      mockBroadcastHandler = handler;
      return mockChannel;
    },
  );
  mockChannel.subscribe.mockReset();
  mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
    callback('SUBSCRIBED');
    return mockChannel;
  });
  mockCreateChannel.mockClear();
  mockRemoveChannel.mockReset();
  mockEq.mockReset();
  mockEq.mockResolvedValue({ data: [], error: null });
  mockGetSupabase.mockReset();
  mockGetSupabase.mockReturnValue({
    rpc: mockRpc,
    channel: mockCreateChannel,
    removeChannel: mockRemoveChannel,
    from: jest.fn(() => ({
      select: jest.fn(() => ({ eq: mockEq })),
    })),
  } as never);
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({
    data: [
      {
        requested_at: '2026-10-26T10:00:00.000Z',
        last_successful_at: '2026-10-26T10:00:00.000Z',
        next_attempt_at: '2026-10-26T10:00:00.000Z',
        last_error: null,
      },
    ],
    error: null,
  });
  mockGetDatabase.mockReset();
  mockGetDatabase.mockResolvedValue({} as never);
  mockDebugLog.mockReset();
  mockReportError.mockReset();
  mockMapRegionalAvailabilityRows.mockReset();
  mockMapRegionalAvailabilityRows.mockReturnValue({ stores: [], brochures: [] });
  mockWriteBrochureDump.mockReset();
  mockWriteBrochureDump.mockResolvedValue({} as never);
});

afterEach(() => {
  jest.useRealTimers();
});

for (const [platform, useHook] of hookVariants) {
  describe(`${platform} brochure sync hook`, () => {
    it('does not start synchronization without a ZIP code', async () => {
      const { result } = await renderHook(() => useHook(null), {
        wrapper: queryClientWrapper(new QueryClient()),
      });

      expect(result.current).toEqual({
        isSyncing: false,
        hasSynced: false,
        isScanPending: false,
        hasScanError: false,
      });
      expect(mockGetSupabase).not.toHaveBeenCalled();
    });

    it('reports catalog failures and finishes the sync state', async () => {
      const failure = new Error('catalog unavailable');
      mockEq.mockResolvedValue({ data: null, error: failure });
      const queryClient = new QueryClient();
      const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = await renderHook(() => useHook('12345'), {
        wrapper: queryClientWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.hasSynced).toBe(true));

      expect(result.current.isSyncing).toBe(false);
      expect(mockReportError).toHaveBeenCalledWith(failure, {
        operation: 'brochure.sync',
        error_code: 'brochure_sync_failed',
      });
      expect(mockGetDatabase).not.toHaveBeenCalled();
      expect(mockWriteBrochureDump).not.toHaveBeenCalled();
      expect(invalidateQueries).not.toHaveBeenCalled();
    });

    it('reports a scan request failure while still completing the catalog sync', async () => {
      const scanRequestFailure = new Error('scan request unavailable');
      mockRpc.mockResolvedValue({ data: null, error: scanRequestFailure });

      const { result } = await renderHook(() => useHook('12345'), {
        wrapper: queryClientWrapper(new QueryClient()),
      });

      await waitFor(() => expect(result.current.hasSynced).toBe(true));

      expect(result.current.hasScanError).toBe(true);
      expect(result.current.isSyncing).toBe(false);
      expect(mockReportError).toHaveBeenCalledWith(scanRequestFailure, {
        operation: 'brochure.sync',
        error_code: 'brochure_scan_request_failed',
      });
      expect(mockWriteBrochureDump).toHaveBeenCalledTimes(1);
    });

    it('marks a completed scan with a provider error as failed', async () => {
      const pendingScan = {
        requested_at: '2026-10-26T10:01:00.000Z',
        last_successful_at: '2026-10-26T10:00:00.000Z',
        next_attempt_at: '2026-10-26T10:01:00.000Z',
        last_error: null,
      };
      const failedScan = {
        ...pendingScan,
        last_error: 'provider unavailable',
      };
      mockRpc
        .mockResolvedValueOnce({ data: [pendingScan], error: null })
        .mockResolvedValueOnce({ data: [pendingScan], error: null });

      const { result } = await renderHook(() => useHook('12345'), {
        wrapper: queryClientWrapper(new QueryClient()),
      });

      await waitFor(() => expect(result.current.isScanPending).toBe(true));
      await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
      mockRpc.mockResolvedValueOnce({ data: [failedScan], error: null });
      mockBroadcastHandler?.({
        payload: { zip_code: '12345', result: 'failed' },
      });
      await waitFor(() => expect(result.current.hasScanError).toBe(true));

      expect(result.current.isScanPending).toBe(false);
      expect(result.current.isSyncing).toBe(false);
      expect(mockReportError).not.toHaveBeenCalled();
      expect(mockWriteBrochureDump).toHaveBeenCalledTimes(1);
    });

    it('reports a status lookup failure and clears the pending state', async () => {
      const pendingScan = {
        requested_at: '2026-10-26T10:01:00.000Z',
        last_successful_at: '2026-10-26T10:00:00.000Z',
        next_attempt_at: '2026-10-26T10:01:00.000Z',
        last_error: null,
      };
      const statusFailure = new Error('status unavailable');
      mockRpc
        .mockResolvedValueOnce({ data: [pendingScan], error: null })
        .mockResolvedValueOnce({ data: [pendingScan], error: null });

      const { result } = await renderHook(() => useHook('12345'), {
        wrapper: queryClientWrapper(new QueryClient()),
      });

      await waitFor(() => expect(result.current.isScanPending).toBe(true));
      await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
      mockRpc.mockResolvedValueOnce({ data: null, error: statusFailure });
      mockBroadcastHandler?.({
        payload: { zip_code: '12345', result: 'succeeded' },
      });
      await waitFor(() => expect(result.current.hasScanError).toBe(true));

      expect(result.current.isScanPending).toBe(false);
      expect(mockReportError).toHaveBeenCalledWith(statusFailure, {
        operation: 'brochure.sync',
        error_code: 'brochure_sync_failed',
      });
    });

    it('shows an error when the initial scan status already contains one', async () => {
      const failedScan = {
        requested_at: '2026-10-26T10:01:00.000Z',
        last_successful_at: '2026-10-26T10:00:00.000Z',
        next_attempt_at: '2026-10-26T10:00:00.000Z',
        last_error: 'provider unavailable',
      };
      mockRpc.mockResolvedValueOnce({ data: [failedScan], error: null });

      const { result } = await renderHook(() => useHook('12345'), {
        wrapper: queryClientWrapper(new QueryClient()),
      });

      await waitFor(() => expect(result.current.hasSynced).toBe(true));

      expect(result.current.hasScanError).toBe(true);
      expect(result.current.isScanPending).toBe(false);
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockReportError).not.toHaveBeenCalled();
    });

    it('falls back to status polling when the private channel disconnects', async () => {
      jest.useFakeTimers();
      const pendingScan = {
        requested_at: '2026-10-26T10:01:00.000Z',
        last_successful_at: '2026-10-26T10:00:00.000Z',
        next_attempt_at: '2026-10-26T10:01:00.000Z',
        last_error: null,
      };
      const completedScan = {
        ...pendingScan,
        last_successful_at: '2026-10-26T10:02:00.000Z',
      };
      mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
        callback('CHANNEL_ERROR');
        return mockChannel;
      });
      mockRpc
        .mockResolvedValueOnce({ data: [pendingScan], error: null })
        .mockResolvedValueOnce({ data: [pendingScan], error: null })
        .mockResolvedValueOnce({ data: [completedScan], error: null });

      const { result, unmount } = await renderHook(() => useHook('12345'), {
        wrapper: queryClientWrapper(new QueryClient()),
      });

      await waitFor(() => expect(result.current.isScanPending).toBe(true));
      expect(mockRpc).toHaveBeenCalledTimes(2);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(30_000);
      });
      await waitFor(() => expect(result.current.isScanPending).toBe(false));

      expect(result.current.hasScanError).toBe(false);
      expect(mockRpc).toHaveBeenNthCalledWith(3, 'get_brochure_zip_scan_status', {
        p_zip_code: '12345',
      });
      await unmount();
    });

    it('ignores broadcasts for another ZIP code or an unknown result', async () => {
      const pendingScan = {
        requested_at: '2026-10-26T10:01:00.000Z',
        last_successful_at: '2026-10-26T10:00:00.000Z',
        next_attempt_at: '2026-10-26T10:01:00.000Z',
        last_error: null,
      };
      mockRpc
        .mockResolvedValueOnce({ data: [pendingScan], error: null })
        .mockResolvedValueOnce({ data: [pendingScan], error: null });

      const { result, unmount } = await renderHook(() => useHook('12345'), {
        wrapper: queryClientWrapper(new QueryClient()),
      });

      await waitFor(() => expect(result.current.isScanPending).toBe(true));
      await act(async () => {
        mockBroadcastHandler?.({
          payload: { zip_code: '54321', result: 'succeeded' },
        });
        mockBroadcastHandler?.({
          payload: { zip_code: '12345', result: 'unknown' },
        });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockRpc).toHaveBeenCalledTimes(2);
      expect(result.current.isScanPending).toBe(true);
      await unmount();
    });

    it('writes only current brochures and invalidates the local query', async () => {
      const activeStore = { id: 'store-active', name: 'REWE' } as NonNullable<
        ReturnType<typeof mapRegionalAvailabilityRows>['stores']
      >[number];
      const expiredStore = { id: 'store-expired', name: 'EDEKA' } as NonNullable<
        ReturnType<typeof mapRegionalAvailabilityRows>['stores']
      >[number];
      const activeBrochure = {
        id: 'brochure-active',
        storeId: activeStore.id,
        validUntil: new Date(Date.now() + 60_000).toISOString(),
        pages: [{ hotspots: [{}, {}] }],
      } as unknown as NonNullable<
        ReturnType<typeof mapRegionalAvailabilityRows>['brochures']
      >[number];
      const expiredBrochure = {
        id: 'brochure-expired',
        storeId: expiredStore.id,
        validUntil: new Date(Date.now() - 60_000).toISOString(),
        pages: [],
      } as unknown as NonNullable<
        ReturnType<typeof mapRegionalAvailabilityRows>['brochures']
      >[number];
      const catalogDump: ReturnType<typeof mapRegionalAvailabilityRows> = {
        stores: [activeStore, expiredStore],
        brochures: [activeBrochure, expiredBrochure],
      };
      const database = {} as Awaited<ReturnType<typeof getDatabase>>;
      mockEq.mockResolvedValue({ data: [{ zip_code: '12345' }], error: null });
      mockMapRegionalAvailabilityRows.mockReturnValue(catalogDump);
      mockGetDatabase.mockResolvedValue(database);
      const queryClient = new QueryClient();
      const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = await renderHook(() => useHook('12345'), {
        wrapper: queryClientWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.hasSynced).toBe(true));

      expect(result.current.isSyncing).toBe(false);
      expect(mockMapRegionalAvailabilityRows).toHaveBeenCalledWith(
        [{ zip_code: '12345' }],
        '12345',
      );
      expect(mockWriteBrochureDump).toHaveBeenCalledWith(database, '12345', {
        stores: [activeStore],
        brochures: [activeBrochure],
      });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['brochures'] });
      expect(mockRpc).toHaveBeenCalledWith('request_brochure_zip_scan', {
        p_zip_code: '12345',
      });
      expect(mockCreateChannel).toHaveBeenCalledWith('brochure-scan:12345', {
        config: { private: true },
      });
      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'scan-finished' },
        expect.any(Function),
      );
      expect(mockChannel.subscribe.mock.invocationCallOrder[0]).toBeLessThan(
        mockRpc.mock.invocationCallOrder[0],
      );
    });

    it('reconciles the PLZ as soon as its private completion broadcast arrives', async () => {
      const pendingScan = {
        requested_at: '2026-10-26T10:01:00.000Z',
        last_successful_at: '2026-10-26T10:00:00.000Z',
        next_attempt_at: '2026-10-26T10:01:00.000Z',
        last_error: null,
      };
      const completedScan = {
        ...pendingScan,
        last_successful_at: '2026-10-26T10:02:00.000Z',
      };
      mockRpc
        .mockResolvedValueOnce({ data: [pendingScan], error: null })
        .mockResolvedValueOnce({ data: [pendingScan], error: null })
        .mockResolvedValueOnce({ data: [completedScan], error: null });

      const { result } = await renderHook(() => useHook('12345'), {
        wrapper: queryClientWrapper(new QueryClient()),
      });

      await waitFor(() => expect(result.current.isScanPending).toBe(true));
      expect(mockRpc).toHaveBeenNthCalledWith(2, 'get_brochure_zip_scan_status', {
        p_zip_code: '12345',
      });

      mockBroadcastHandler?.({
        payload: { zip_code: '12345', result: 'succeeded' },
      });

      await waitFor(() => expect(result.current.isScanPending).toBe(false));
      expect(result.current.hasScanError).toBe(false);
      expect(mockRpc).toHaveBeenNthCalledWith(3, 'get_brochure_zip_scan_status', {
        p_zip_code: '12345',
      });
      expect(mockEq).toHaveBeenCalledTimes(2);
    });

    it('does not poll while the private Realtime channel stays connected', async () => {
      jest.useFakeTimers();
      const pendingScan = {
        requested_at: '2026-10-26T10:01:00.000Z',
        last_successful_at: '2026-10-26T10:00:00.000Z',
        next_attempt_at: '2026-10-26T10:01:00.000Z',
        last_error: null,
      };
      mockRpc
        .mockResolvedValueOnce({ data: [pendingScan], error: null })
        .mockResolvedValueOnce({ data: [pendingScan], error: null });

      const { result, unmount } = await renderHook(() => useHook('12345'), {
        wrapper: queryClientWrapper(new QueryClient()),
      });

      await waitFor(() => expect(result.current.isScanPending).toBe(true));
      expect(mockRpc).toHaveBeenCalledTimes(2);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000);
      });

      expect(mockRpc).toHaveBeenCalledTimes(2);
      await unmount();
    });

    it('removes its private scan channel when the hook unmounts', async () => {
      const { unmount } = await renderHook(() => useHook('12345'), {
        wrapper: queryClientWrapper(new QueryClient()),
      });

      await unmount();

      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
}
