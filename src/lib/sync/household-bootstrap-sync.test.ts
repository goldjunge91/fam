const mockPullHousehold = jest.fn();
const mockGetDatabase = jest.fn();
const mockGetSupabase = jest.fn();
const mockServerNowMs = jest.fn(() => null);
const mockBeginAccountSyncRun = jest.fn();
const mockRegisterAccountSyncStopper = jest.fn();
const mockStartNetworkReconnectTrigger = jest.fn();

jest.mock('@/lib/sync/pull', () => ({
  pullHousehold: (...args: unknown[]) => mockPullHousehold(...args),
}));

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: (...args: unknown[]) => mockGetSupabase(...args),
  serverClock: {
    serverNowMs: () => mockServerNowMs(),
  },
}));

// Dieser Unit-Test prueft den Haushalts-Pull, nicht das Sentry-SDK. Dessen
// Modulimport startet sonst einen dauerhaften Cleanup-Timer im Jest-Prozess.
jest.mock('@/lib/telemetry', () => ({
  reportError: jest.fn(),
}));

jest.mock('@/lib/sync/remote-sync-gate', () => ({
  beginAccountSyncRun: (...args: unknown[]) => mockBeginAccountSyncRun(...args),
  registerAccountSyncStopper: (...args: unknown[]) => mockRegisterAccountSyncStopper(...args),
}));

jest.mock('@/lib/sync/network-trigger', () => ({
  startNetworkReconnectTrigger: (...args: unknown[]) => mockStartNetworkReconnectTrigger(...args),
}));

jest.mock('@/features/household/query-keys', () => ({
  householdsQueryKey: (userId: string | undefined) => ['households', 'by-user', userId] as const,
}));

import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import {
  triggerHouseholdsPull,
  useHouseholdsBootstrapSync,
} from '@/lib/sync/household-bootstrap-sync';

function fakeQueryClient() {
  return { invalidateQueries: jest.fn() };
}

describe('triggerHouseholdsPull', () => {
  beforeEach(() => {
    mockPullHousehold.mockReset();
    mockGetDatabase.mockResolvedValue({});
    mockGetSupabase.mockReturnValue({});
    mockServerNowMs.mockReturnValue(null);
    mockBeginAccountSyncRun.mockReturnValue(jest.fn());
    mockRegisterAccountSyncStopper.mockReturnValue(jest.fn());
    mockStartNetworkReconnectTrigger.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pullt ausschliesslich die Entity households, unabhaengig von einem Haushalt', async () => {
    mockPullHousehold.mockResolvedValue([
      { entity: 'households', pagesFetched: 1, rowsWritten: 1, rowsSkippedAsLocalWins: 0 },
    ]);

    await triggerHouseholdsPull('user-1');

    expect(mockPullHousehold).toHaveBeenCalledTimes(1);
    const call = mockPullHousehold.mock.calls[0][0];
    expect(call.entities).toEqual(['households']);
    expect(call.householdIds).toEqual([]);
  });

  it('serialisiert nebenlaeufige Aufrufe ueber die eigene In-Flight-Sperre', async () => {
    let resolvePull: (value: unknown) => void = () => {};
    mockPullHousehold.mockReturnValue(
      new Promise((resolve) => {
        resolvePull = resolve;
      }),
    );

    const first = triggerHouseholdsPull('user-1');
    const second = triggerHouseholdsPull('user-1');

    expect(await second).toBeNull();
    resolvePull([
      { entity: 'households', pagesFetched: 1, rowsWritten: 0, rowsSkippedAsLocalWins: 0 },
    ]);
    await first;

    expect(mockPullHousehold).toHaveBeenCalledTimes(1);
  });

  it('invalidiert bei Erfolg die nutzerscoped households-Query', async () => {
    mockPullHousehold.mockResolvedValue([
      { entity: 'households', pagesFetched: 1, rowsWritten: 1, rowsSkippedAsLocalWins: 0 },
    ]);
    const queryClient = fakeQueryClient();

    // biome-ignore lint/suspicious/noExplicitAny: Test-Double, keine echte QueryClient-Instanz noetig
    await triggerHouseholdsPull('user-1', queryClient as any);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['households', 'by-user', 'user-1'],
      refetchType: 'all',
    });
  });

  it('ohne uebergebenen QueryClient bleibt das Verhalten unveraendert (kein Crash)', async () => {
    mockPullHousehold.mockResolvedValue([]);

    await expect(triggerHouseholdsPull('user-1')).resolves.not.toBeNull();
  });

  it('faengt einen fehlschlagenden Pull ab und gibt null zurueck', async () => {
    mockPullHousehold.mockRejectedValue(new Error('offline'));

    await expect(triggerHouseholdsPull('user-1')).resolves.toBeNull();
  });
});

describe('useHouseholdsBootstrapSync', () => {
  let appStateHandler: ((state: string) => void) | undefined;
  let currentStateDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    appStateHandler = undefined;
    mockPullHousehold.mockReset().mockResolvedValue([]);
    mockGetDatabase.mockResolvedValue({});
    mockGetSupabase.mockReturnValue({});
    mockBeginAccountSyncRun.mockReset().mockReturnValue(jest.fn());
    mockRegisterAccountSyncStopper.mockReset().mockReturnValue(jest.fn());
    mockStartNetworkReconnectTrigger.mockReset().mockReturnValue(jest.fn());
    currentStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      appStateHandler = handler as (state: string) => void;
      return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (currentStateDescriptor) {
      Object.defineProperty(AppState, 'currentState', currentStateDescriptor);
    } else {
      Reflect.deleteProperty(AppState, 'currentState');
    }
    jest.useRealTimers();
  });

  it('liefert ohne Nutzer den leeren Bootstrap-Zustand und startet keine Poller', async () => {
    const { result } = await renderHook(() => useHouseholdsBootstrapSync(undefined));

    expect(result.current).toEqual({
      isInitialSyncComplete: false,
      isInitialSyncError: false,
    });
    expect(mockPullHousehold).not.toHaveBeenCalled();
    expect(mockStartNetworkReconnectTrigger).not.toHaveBeenCalled();
  });

  it('pollt nur im Vordergrund und reagiert auf den Wechsel zur aktiven App', async () => {
    jest.useFakeTimers();
    mockPullHousehold.mockResolvedValue([
      { entity: 'households', pagesFetched: 1, rowsWritten: 1, rowsSkippedAsLocalWins: 0 },
    ]);
    const { unmount } = await renderHook(() => useHouseholdsBootstrapSync('user-1'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockPullHousehold).toHaveBeenCalledTimes(1);

    mockPullHousehold.mockClear();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000);
    });
    expect(mockPullHousehold).toHaveBeenCalledTimes(1);

    mockPullHousehold.mockClear();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000);
      appStateHandler?.('inactive');
    });
    expect(mockPullHousehold).not.toHaveBeenCalled();

    await act(async () => {
      appStateHandler?.('active');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockPullHousehold).toHaveBeenCalledTimes(1);

    await unmount();
  });
});
