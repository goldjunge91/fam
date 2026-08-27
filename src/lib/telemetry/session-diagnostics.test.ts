import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import { startSessionDiagnostics } from './session-diagnostics';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('session diagnostics', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appStateListener = listener;
      return { remove: jest.fn() } as NativeEventSubscription;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('meldet einen beim letzten Start offen gebliebenen Marker und schliesst im Hintergrund', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(
      JSON.stringify({
        sessionId: 'previous-1',
        state: 'open',
        startedAt: 1_000,
        lastEventAt: Date.now() - 5_000,
        lastOperation: 'db.open',
        lastRoute: '/fridge',
      }),
    );
    const onPreviousSessionUnclean = jest.fn();

    const stop = await startSessionDiagnostics({
      onPreviousSessionUnclean,
      onEventLoopStalled: jest.fn(),
    });

    expect(onPreviousSessionUnclean).toHaveBeenCalledWith(
      expect.objectContaining({
        previous_session_id: 'previous-1',
        last_operation: 'db.open',
        last_route: '/fridge',
        seconds_since_last_event: 5,
      }),
    );

    appStateListener?.('background');
    await Promise.resolve();

    const persisted = JSON.parse(jest.mocked(AsyncStorage.setItem).mock.calls.at(-1)?.[1] ?? '{}');
    expect(persisted.state).toBe('closed');
    stop();
  });
});
