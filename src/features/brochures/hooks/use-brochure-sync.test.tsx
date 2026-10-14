import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { getDatabase } from '@/lib/db/local-client';
import { debugLog } from '@/lib/observability/debug-log';
import { reportError } from '@/lib/telemetry';
import { mapCanonicalAvailabilityRows, writeBrochureDump } from '../brochure-sync';
import { useBrochureSync } from './use-brochure-sync';
import { useBrochureSync as useBrochureSyncAndroid } from './use-brochure-sync.android';

jest.mock('@/lib/backend/supabase/remote-client', () => ({ getSupabase: jest.fn() }));
jest.mock('@/lib/db/local-client', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/observability/debug-log', () => ({ debugLog: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({ reportError: jest.fn() }));
jest.mock('../brochure-sync', () => ({
  mapCanonicalAvailabilityRows: jest.fn(),
  writeBrochureDump: jest.fn(),
}));

const mockGetSupabase = jest.mocked(getSupabase);
const mockGetDatabase = jest.mocked(getDatabase);
const mockDebugLog = jest.mocked(debugLog);
const mockReportError = jest.mocked(reportError);
const mockMapCanonicalAvailabilityRows = jest.mocked(mapCanonicalAvailabilityRows);
const mockWriteBrochureDump = jest.mocked(writeBrochureDump);
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
  mockEq.mockReset();
  mockEq.mockResolvedValue({ data: [], error: null });
  mockGetSupabase.mockReset();
  mockGetSupabase.mockReturnValue({
    from: jest.fn(() => ({
      select: jest.fn(() => ({ eq: mockEq })),
    })),
  } as never);
  mockGetDatabase.mockReset();
  mockGetDatabase.mockResolvedValue({} as never);
  mockDebugLog.mockReset();
  mockReportError.mockReset();
  mockMapCanonicalAvailabilityRows.mockReset();
  mockMapCanonicalAvailabilityRows.mockReturnValue({ stores: [], brochures: [] });
  mockWriteBrochureDump.mockReset();
  mockWriteBrochureDump.mockResolvedValue({} as never);
});

for (const [platform, useHook] of hookVariants) {
  describe(`${platform} brochure sync hook`, () => {
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

    it('writes only current brochures and invalidates the local query', async () => {
      const activeStore = { id: 'store-active', name: 'REWE' } as NonNullable<
        ReturnType<typeof mapCanonicalAvailabilityRows>['stores']
      >[number];
      const expiredStore = { id: 'store-expired', name: 'EDEKA' } as NonNullable<
        ReturnType<typeof mapCanonicalAvailabilityRows>['stores']
      >[number];
      const activeBrochure = {
        id: 'brochure-active',
        storeId: activeStore.id,
        validUntil: new Date(Date.now() + 60_000).toISOString(),
        pages: [{ hotspots: [{}, {}] }],
      } as unknown as NonNullable<
        ReturnType<typeof mapCanonicalAvailabilityRows>['brochures']
      >[number];
      const expiredBrochure = {
        id: 'brochure-expired',
        storeId: expiredStore.id,
        validUntil: new Date(Date.now() - 60_000).toISOString(),
        pages: [],
      } as unknown as NonNullable<
        ReturnType<typeof mapCanonicalAvailabilityRows>['brochures']
      >[number];
      const catalogDump: ReturnType<typeof mapCanonicalAvailabilityRows> = {
        stores: [activeStore, expiredStore],
        brochures: [activeBrochure, expiredBrochure],
      };
      const database = {} as Awaited<ReturnType<typeof getDatabase>>;
      mockEq.mockResolvedValue({ data: [{ zip_code: '12345' }], error: null });
      mockMapCanonicalAvailabilityRows.mockReturnValue(catalogDump);
      mockGetDatabase.mockResolvedValue(database);
      const queryClient = new QueryClient();
      const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = await renderHook(() => useHook('12345'), {
        wrapper: queryClientWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.hasSynced).toBe(true));

      expect(result.current.isSyncing).toBe(false);
      expect(mockMapCanonicalAvailabilityRows).toHaveBeenCalledWith(
        [{ zip_code: '12345' }],
        '12345',
      );
      expect(mockWriteBrochureDump).toHaveBeenCalledWith(database, '12345', {
        stores: [activeStore],
        brochures: [activeBrochure],
      });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['brochures'] });
    });
  });
}
