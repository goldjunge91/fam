import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { getDeviceStorage } from '../storage/local-device-storage';

import { startSessionDiagnostics } from './session-diagnostics';

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
});
