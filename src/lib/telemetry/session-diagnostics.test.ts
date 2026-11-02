import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { getDeviceStorage } from '../storage/local-device-storage';

import {
  recordSessionOperation,
  recordSessionRoute,
  startSessionDiagnostics,
} from './session-diagnostics';

jest.mock('../storage/local-device-storage', () => ({
  getDeviceStorage: jest.fn(),
}));

describe('session diagnostics', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;
  const deviceStorage = {
    getString: jest.fn<string | undefined, [string]>(),
    set: jest.fn<void, [string, string]>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest
      .mocked(getDeviceStorage)
      .mockReturnValue(deviceStorage as unknown as ReturnType<typeof getDeviceStorage>);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appStateListener = listener;
      return { remove: jest.fn() } as NativeEventSubscription;
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('meldet die vorherige Session samt App-Zustand und hält den Marker im Hintergrund offen', async () => {
    deviceStorage.getString.mockReturnValueOnce(
      JSON.stringify({
        sessionId: 'previous-1',
        state: 'open',
        startedAt: 1_000,
        lastEventAt: Date.now() - 5_000,
        lastAppState: 'background',
        lastOperation: 'db.open',
        lastRoute: '/fridge',
      }),
    );
    const onPreviousSessionDetected = jest.fn();

    const stop = await startSessionDiagnostics({
      onPreviousSessionDetected,
      onEventLoopStalled: jest.fn(),
    });

    expect(onPreviousSessionDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        previous_session_id: 'previous-1',
        previous_app_state: 'background',
        last_operation: 'db.open',
        last_route: '/fridge',
        seconds_since_last_event: 5,
      }),
    );

    appStateListener?.('background');

    const persisted = JSON.parse(deviceStorage.set.mock.calls.at(-1)?.[1] ?? '{}');
    expect(persisted.state).toBe('open');
    expect(persisted.lastAppState).toBe('background');
    expect(persisted.lastOperation).toBe('app.backgrounded');
    stop();
  });

  it('ignoriert einen beschädigten Marker und schließt die neue Session beim Stoppen', async () => {
    deviceStorage.getString.mockReturnValueOnce('{invalid json');
    const onPreviousSessionDetected = jest.fn();

    const stop = await startSessionDiagnostics({
      onPreviousSessionDetected,
      onEventLoopStalled: jest.fn(),
    });

    expect(onPreviousSessionDetected).not.toHaveBeenCalled();
    expect(JSON.parse(deviceStorage.set.mock.calls.at(-1)?.[1] ?? '{}')).toMatchObject({
      state: 'open',
    });

    stop();

    expect(JSON.parse(deviceStorage.set.mock.calls.at(-1)?.[1] ?? '{}')).toMatchObject({
      state: 'closed',
    });
  });

  it('meldet eine offene Vor-Session ohne optionale Diagnosefelder', async () => {
    deviceStorage.getString.mockReturnValueOnce(
      JSON.stringify({ sessionId: 'previous-minimal', state: 'open', lastEventAt: Date.now() }),
    );
    const onPreviousSessionDetected = jest.fn();

    const stop = await startSessionDiagnostics({
      onPreviousSessionDetected,
      onEventLoopStalled: jest.fn(),
    });

    expect(onPreviousSessionDetected).toHaveBeenCalledWith({
      previous_session_id: 'previous-minimal',
      last_event_at: expect.any(Number),
      seconds_since_last_event: 0,
    });

    stop();
  });

  it('meldet eine bereits geschlossene Vor-Session nicht erneut als abgebrochen', async () => {
    deviceStorage.getString.mockReturnValueOnce(
      JSON.stringify({ sessionId: 'previous-closed', state: 'closed', lastEventAt: Date.now() }),
    );
    const onPreviousSessionDetected = jest.fn();

    const stop = await startSessionDiagnostics({
      onPreviousSessionDetected,
      onEventLoopStalled: jest.fn(),
    });

    expect(onPreviousSessionDetected).not.toHaveBeenCalled();

    stop();
  });

  it('persistiert Operations- und Routenänderungen gemeinsam nach kurzer Verzögerung', async () => {
    const stop = await startSessionDiagnostics({
      onPreviousSessionDetected: jest.fn(),
      onEventLoopStalled: jest.fn(),
    });
    deviceStorage.set.mockClear();

    recordSessionOperation('inventory.refresh');
    recordSessionRoute('/inventory');

    expect(deviceStorage.set).not.toHaveBeenCalled();
    jest.advanceTimersByTime(250);

    expect(deviceStorage.set).toHaveBeenCalledTimes(1);
    expect(JSON.parse(deviceStorage.set.mock.calls[0]?.[1] ?? '{}')).toMatchObject({
      lastOperation: 'inventory.refresh',
      lastRoute: '/inventory',
    });

    stop();
  });

  it('meldet App-Hintergrund und Rückkehr in den Vordergrund', async () => {
    const onBackgrounded = jest.fn();
    const onForegrounded = jest.fn();
    const stop = await startSessionDiagnostics({
      onPreviousSessionDetected: jest.fn(),
      onEventLoopStalled: jest.fn(),
      onBackgrounded,
      onForegrounded,
    });

    appStateListener?.('background');
    appStateListener?.('inactive');
    appStateListener?.('active');
    appStateListener?.('active');

    expect(onBackgrounded).toHaveBeenCalledTimes(1);
    expect(onForegrounded).toHaveBeenCalledTimes(1);
    expect(JSON.parse(deviceStorage.set.mock.calls.at(-1)?.[1] ?? '{}')).toMatchObject({
      state: 'open',
      lastAppState: 'active',
      lastOperation: 'app.foregrounded',
    });

    stop();
  });
});
