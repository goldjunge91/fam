import { renderHook, waitFor } from '@testing-library/react-native';
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
jest.mock('@/lib/sync/remote-background-sync', () => ({
  registerBackgroundSync: () => mockRegisterBackgroundSync(),
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
    mockStartQueryEnvironmentSync.mockReturnValue(mockStopQueryEnvironmentSync);
    mockRegisterBackgroundSync.mockReset().mockResolvedValue(undefined);
    mockStartSessionDiagnostics
      .mockReset()
      .mockImplementation((_callbacks) => Promise.resolve(mockStopSessionDiagnostics));
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
