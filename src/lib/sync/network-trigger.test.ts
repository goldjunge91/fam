import { addDiagnosticStep, reportError } from '@/lib/telemetry';
import { startNetworkReconnectTrigger } from './network-trigger';

type NetworkListener = Parameters<typeof import('expo-network').addNetworkStateListener>[0];

let mockListener: NetworkListener | null = null;
const mockRemove = jest.fn();
const mockAddNetworkStateListener = jest.fn((listener: NetworkListener) => {
  mockListener = listener;
  return { remove: mockRemove };
});

jest.mock('expo-network', () => ({
  addNetworkStateListener: (listener: NetworkListener) => mockAddNetworkStateListener(listener),
}));
jest.mock('@/lib/telemetry', () => ({
  addDiagnosticStep: jest.fn(),
  reportError: jest.fn(),
}));

function emitNetworkState(state: Parameters<NetworkListener>[0]) {
  if (!mockListener) throw new Error('The network listener has not been registered.');
  mockListener(state);
}

beforeEach(() => {
  mockListener = null;
  mockRemove.mockClear();
  mockAddNetworkStateListener.mockClear();
  jest.mocked(addDiagnosticStep).mockClear();
  jest.mocked(reportError).mockClear();
});

describe('startNetworkReconnectTrigger', () => {
  it('triggers only on offline-to-online transitions and throttles reconnects', () => {
    let nowMs = 0;
    const onReconnect = jest.fn(async () => undefined);
    const stop = startNetworkReconnectTrigger({ onReconnect, now: () => nowMs });

    expect(mockAddNetworkStateListener).toHaveBeenCalledTimes(1);
    emitNetworkState({});
    emitNetworkState({ isInternetReachable: undefined, isConnected: false });
    nowMs = 1_000;
    emitNetworkState({ isInternetReachable: true, isConnected: false });
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(addDiagnosticStep).toHaveBeenCalledWith('network.reconnected', {
      operation: 'network.reconnect',
      network_state: 'online',
    });

    emitNetworkState({ isInternetReachable: false, isConnected: true });
    nowMs = 2_000;
    emitNetworkState({ isInternetReachable: undefined, isConnected: true });
    expect(onReconnect).toHaveBeenCalledTimes(1);

    emitNetworkState({ isConnected: false });
    nowMs = 11_000;
    emitNetworkState({ isInternetReachable: true });
    expect(onReconnect).toHaveBeenCalledTimes(2);

    stop();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('reports a rejected reconnect attempt without breaking the listener', async () => {
    const error = new Error('offline retry failed');
    const onReconnect = jest.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
    const stop = startNetworkReconnectTrigger({ onReconnect, minIntervalMs: 0 });

    emitNetworkState({ isConnected: false });
    emitNetworkState({ isConnected: true });
    await Promise.resolve();

    expect(reportError).toHaveBeenCalledWith(error, {
      operation: 'network.reconnect',
      error_code: 'network_reconnect_failed',
    });

    emitNetworkState({ isConnected: false });
    emitNetworkState({ isConnected: true });
    expect(onReconnect).toHaveBeenCalledTimes(2);
    stop();
  });
});
