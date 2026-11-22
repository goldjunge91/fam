import { renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import type { startSessionDiagnostics } from '@/lib/telemetry/session-diagnostics';
import { useAppLifecycle } from './use-app-lifecycle';

type DiagnosticsCallbacks = Parameters<typeof startSessionDiagnostics>[0];

const mockNavigationRef = { key: 'navigation-container' };
const mockRegisterNavigationContainer = jest.fn();
const mockStopQueryEnvironmentSync = jest.fn();
const mockStartQueryEnvironmentSync = jest.fn(() => mockStopQueryEnvironmentSync);
const mockMarkPerformance = jest.fn();
const mockMeasurePerformance = jest.fn();
const mockMetricPerformance = jest.fn();
const mockDebugLog = jest.fn();
const mockDebugWarn = jest.fn();
const mockRegisterBackgroundSync = jest.fn<Promise<void>, []>();
const mockCloseDatabaseForLifecycle = jest.fn<Promise<void>, []>();
const mockSuspendForegroundSync = jest.fn();
const mockResumeForegroundSync = jest.fn();
const mockSuspendOffDumpOperations = jest.fn();
const mockResumeOffDumpOperations = jest.fn();
const mockEndBackgroundContext = jest.fn();
const mockBeginBackgroundContext = jest.fn((_name: string) => ({
  kind: 'background' as const,
  name: 'db.lifecycle.close',
  token: 'background-token-1',
  signal: new AbortController().signal,
  ended: false,
  end: mockEndBackgroundContext,
}));
const mockRemoveAppStateListener = jest.fn();
let appStateListener: ((state: AppStateStatus) => void) | undefined;
const mockAddDiagnosticStep = jest.fn();
const mockReportError = jest.fn();
const mockTrackEvent = jest.fn();
const mockRecordLifecycleEvent = jest.fn();
const mockStopSessionDiagnostics = jest.fn();
const mockStartSessionDiagnostics = jest.fn((_callbacks: DiagnosticsCallbacks) =>
  Promise.resolve(mockStopSessionDiagnostics),
);

jest.mock('expo-router', () => ({
  useNavigationContainerRef: () => mockNavigationRef,
}));
jest.mock('@/lib/data/query-client', () => ({
  startQueryEnvironmentSync: () => mockStartQueryEnvironmentSync(),
}));
jest.mock('@/lib/observability/debug-log', () => ({
  debugLog: (...args: unknown[]) => mockDebugLog(...args),
  debugWarn: (...args: unknown[]) => mockDebugWarn(...args),
}));
jest.mock('@/lib/observability/performance', () => ({
  markPerformance: (...args: unknown[]) => mockMarkPerformance(...args),
  measurePerformance: (...args: unknown[]) => mockMeasurePerformance(...args),
  metricPerformance: (...args: unknown[]) => mockMetricPerformance(...args),
}));
jest.mock('@/lib/observability/providers/sentry', () => ({
  navigationIntegration: {
    registerNavigationContainer: (...args: unknown[]) => mockRegisterNavigationContainer(...args),
  },
}));
jest.mock('@/lib/db/local-client', () => ({
  closeDatabaseForLifecycle: () => mockCloseDatabaseForLifecycle(),
}));
jest.mock('@/lib/apple/shared-store-lifecycle', () => ({
  beginBackgroundContext: (name: string) => mockBeginBackgroundContext(name),
}));
jest.mock('@/lib/off-dump/off-dump', () => ({
  resumeOffDumpOperations: () => mockResumeOffDumpOperations(),
  suspendOffDumpOperations: () => mockSuspendOffDumpOperations(),
}));
jest.mock('@/lib/sync/remote-background-sync', () => ({
  registerBackgroundSync: () => mockRegisterBackgroundSync(),
}));
jest.mock('@/lib/sync/sync-runner', () => ({
  resumeForegroundSync: () => mockResumeForegroundSync(),
  suspendForegroundSync: () => mockSuspendForegroundSync(),
}));
jest.mock('@/lib/telemetry', () => ({
  addDiagnosticStep: (...args: unknown[]) => mockAddDiagnosticStep(...args),
  reportError: (...args: unknown[]) => mockReportError(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));
jest.mock('@/lib/telemetry/lifecycle-log', () => ({
  recordLifecycleEvent: (...args: unknown[]) => mockRecordLifecycleEvent(...args),
}));
jest.mock('@/lib/telemetry/session-diagnostics', () => ({
  startSessionDiagnostics: (callbacks: DiagnosticsCallbacks) =>
    mockStartSessionDiagnostics(callbacks),
}));

describe('useAppLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateListener = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appStateListener = listener;
      return { remove: mockRemoveAppStateListener } as ReturnType<typeof AppState.addEventListener>;
    });
    mockCloseDatabaseForLifecycle.mockResolvedValue(undefined);
    mockBeginBackgroundContext.mockClear();
    mockEndBackgroundContext.mockClear();
    mockStartQueryEnvironmentSync.mockReturnValue(mockStopQueryEnvironmentSync);
    mockRegisterBackgroundSync.mockReset().mockResolvedValue(undefined);
    mockStartSessionDiagnostics
      .mockReset()
      .mockImplementation((_callbacks) => Promise.resolve(mockStopSessionDiagnostics));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pauses writers before closing SQLite and resumes them in the foreground', async () => {
    const order: string[] = [];
    mockSuspendForegroundSync.mockImplementation(() => order.push('sync-suspended'));
    mockSuspendOffDumpOperations.mockImplementation(() => order.push('dump-suspended'));
    mockCloseDatabaseForLifecycle.mockImplementation(async () => {
      order.push('database-closed');
    });
    mockResumeOffDumpOperations.mockImplementation(() => order.push('dump-resumed'));
    mockResumeForegroundSync.mockImplementation(() => order.push('sync-resumed'));

    const { unmount } = await renderHook(() => useAppLifecycle());

    appStateListener?.('inactive');
    await Promise.resolve();
    expect(order).toEqual(['sync-suspended', 'dump-suspended', 'database-closed']);

    appStateListener?.('active');
    expect(order).toEqual([
      'sync-suspended',
      'dump-suspended',
      'database-closed',
      'dump-resumed',
      'sync-resumed',
    ]);

    await unmount();
    expect(mockRemoveAppStateListener).toHaveBeenCalledTimes(1);
  });

  it('admits the close context before closing SQLite and ends it after resolution', async () => {
    const events: string[] = [];
    mockBeginBackgroundContext.mockImplementationOnce((name) => {
      events.push('context-admitted');
      return {
        kind: 'background' as const,
        name,
        token: 'background-token-1',
        signal: new AbortController().signal,
        ended: false,
        end: mockEndBackgroundContext,
      };
    });
    mockEndBackgroundContext.mockImplementationOnce(() => {
      events.push('context-ended');
    });

    let resolveClose!: () => void;
    const closePromise = new Promise<void>((resolve) => {
      resolveClose = resolve;
    });
    mockCloseDatabaseForLifecycle.mockImplementationOnce(() => {
      events.push('close-started');
      return closePromise;
    });

    const { unmount } = await renderHook(() => useAppLifecycle());

    appStateListener?.('inactive');

    expect(mockBeginBackgroundContext).toHaveBeenCalledWith('db.lifecycle.close');
    expect(mockEndBackgroundContext).not.toHaveBeenCalled();
    expect(events).toEqual(['context-admitted', 'close-started']);

    resolveClose();
    await waitFor(() => expect(mockEndBackgroundContext).toHaveBeenCalledTimes(1));
    expect(events).toEqual(['context-admitted', 'close-started', 'context-ended']);

    await unmount();
  });

  it('admits the close context before closing SQLite and ends it after rejection', async () => {
    const events: string[] = [];
    mockBeginBackgroundContext.mockImplementationOnce((name) => {
      events.push('context-admitted');
      return {
        kind: 'background' as const,
        name,
        token: 'background-token-1',
        signal: new AbortController().signal,
        ended: false,
        end: mockEndBackgroundContext,
      };
    });
    mockEndBackgroundContext.mockImplementationOnce(() => {
      events.push('context-ended');
    });

    const error = new Error('close failed');
    mockCloseDatabaseForLifecycle.mockImplementationOnce(() => {
      events.push('close-started');
      return Promise.reject(error);
    });

    const { unmount } = await renderHook(() => useAppLifecycle());

    appStateListener?.('inactive');

    await waitFor(() => expect(mockEndBackgroundContext).toHaveBeenCalledTimes(1));
    expect(events).toEqual(['context-admitted', 'close-started', 'context-ended']);
    expect(mockDebugWarn).toHaveBeenCalledWith(
      '[AppLifecycle] Datenbank-Close fehlgeschlagen:',
      error,
    );

    await unmount();
  });

  it('registers startup services, records lifecycle events, and disposes them on unmount', async () => {
    const { unmount } = await renderHook(() => useAppLifecycle());

    await waitFor(() => expect(mockStartSessionDiagnostics).toHaveBeenCalledTimes(1));
    expect(mockRegisterNavigationContainer).toHaveBeenCalledWith(mockNavigationRef);
    expect(mockMarkPerformance).toHaveBeenCalledWith('app.root.mounted', { phase: 'react' });
    expect(mockMarkPerformance).toHaveBeenCalledWith('app.startup.ready', {
      phase: 'startup',
      first_render: true,
    });
    expect(mockMeasurePerformance).toHaveBeenCalledTimes(2);
    expect(mockMetricPerformance).toHaveBeenCalledWith('app.startup.completed', 1, {
      phase: 'startup',
      first_render: true,
    });
    expect(mockAddDiagnosticStep).toHaveBeenCalledWith('app.started', {
      operation: 'app.start',
      outcome: 'started',
    });

    const callbacks = mockStartSessionDiagnostics.mock.calls[0]?.[0];
    if (!callbacks) throw new Error('Expected session diagnostics callbacks');
    callbacks.onPreviousSessionDetected({
      previous_app_state: 'background',
      last_operation: 'inventory.sync',
      last_route: '/inventory',
      seconds_since_last_event: 8,
      duration_ms: 240,
    });
    callbacks.onPreviousSessionDetected({ previous_app_state: 'active' });
    callbacks.onEventLoopStalled({ duration_ms: 2_400 });
    callbacks.onBackgrounded?.();
    callbacks.onForegrounded?.();

    expect(mockTrackEvent).toHaveBeenCalledWith(
      'app.previous_session.ended',
      expect.objectContaining({ outcome: 'ended_after_background' }),
    );
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'app.previous_session.interrupted',
      expect.objectContaining({ outcome: 'interrupted' }),
    );
    expect(mockTrackEvent).toHaveBeenCalledWith('app.event_loop.stalled', { duration_ms: 2_400 });
    expect(mockRecordLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'app.backgrounded', level: 'info' }),
    );
    expect(mockRecordLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'app.foregrounded', level: 'info' }),
    );

    await unmount();
    expect(mockStopQueryEnvironmentSync).toHaveBeenCalledTimes(1);
    expect(mockStopSessionDiagnostics).toHaveBeenCalledTimes(1);
    expect(mockDebugLog).toHaveBeenCalledWith('[APPTRACE:ROOT-UNMOUNT]');
  });

  it('reports diagnostic initialization errors and warns when background sync registration fails', async () => {
    const error = new Error('service unavailable');
    mockStartSessionDiagnostics.mockRejectedValueOnce(error);
    mockRegisterBackgroundSync.mockRejectedValueOnce(error);

    await renderHook(() => useAppLifecycle());

    await waitFor(() => {
      expect(mockReportError).toHaveBeenCalledWith(error, {
        operation: 'app.session_diagnostics',
        error_code: 'session_diagnostics_failed',
      });
      expect(mockDebugWarn).toHaveBeenCalledWith(
        '[BackgroundSync] Registrierung fehlgeschlagen:',
        error,
      );
    });
  });
});
