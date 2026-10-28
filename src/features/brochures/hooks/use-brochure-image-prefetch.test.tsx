import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import type { BrochureImagePrefetchReference } from '../lib/brochure-image-prefetch';
import { useBrochureImagePrefetch } from './use-brochure-image-prefetch';

type NetworkState = {
  type: string;
  isConnected?: boolean;
  isInternetReachable?: boolean;
};

const mockImagePrefetch = jest.fn();
const mockGetNetworkStateAsync = jest.fn();
let mockNetworkListener: ((state: NetworkState) => void) | undefined;
let mockAppStateListener: ((state: AppStateStatus) => void) | undefined;
const mockNetworkRemove = jest.fn();
const mockAppStateRemove = jest.fn();
let resolveNetworkState: ((state: NetworkState) => void) | undefined;

async function flushPrefetch(): Promise<void> {
  await waitFor(() => expect(mockImagePrefetch).toHaveBeenCalled());
  const pending = mockImagePrefetch.mock.results.at(-1)?.value;
  if (pending instanceof Promise) await pending;
}

jest.mock('expo-image', () => ({
  Image: { prefetch: (...args: unknown[]) => mockImagePrefetch(...args) },
}));

jest.mock('expo-network', () => ({
  NetworkStateType: { WIFI: 'WIFI' },
  addNetworkStateListener: (listener: (state: NetworkState) => void) => {
    mockNetworkListener = listener;
    return { remove: mockNetworkRemove };
  },
  getNetworkStateAsync: (...args: unknown[]) => mockGetNetworkStateAsync(...args),
}));

const references: BrochureImagePrefetchReference[] = [
  { uri: 'https://images.example/weekly.jpg', validUntil: '2026-11-01T00:00:00.000Z' },
];

describe('useBrochureImagePrefetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetworkListener = undefined;
    mockAppStateListener = undefined;
    resolveNetworkState = undefined;
    mockImagePrefetch.mockResolvedValue(true);
    mockGetNetworkStateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNetworkState = resolve;
        }),
    );
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'change') mockAppStateListener = listener;
      return { remove: mockAppStateRemove };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lässt das Netzwerk unberührt, wenn PLZ oder Referenzen fehlen', async () => {
    const { rerender } = await renderHook(
      ({ zip, items }: { zip: string | null; items: readonly BrochureImagePrefetchReference[] }) =>
        useBrochureImagePrefetch(items, zip),
      { initialProps: { zip: null, items: references } },
    );

    await rerender({ zip: '10115', items: [] });
    expect(mockGetNetworkStateAsync).not.toHaveBeenCalled();
    expect(mockNetworkListener).toBeUndefined();
  });

  it('prefetcht über Wi-Fi und entfernt beide Listener beim Unmount', async () => {
    const { unmount } = await renderHook(() => useBrochureImagePrefetch(references, '10115'));
    if (!resolveNetworkState) throw new Error('Expected the initial network request');
    resolveNetworkState({ type: 'WIFI', isConnected: true, isInternetReachable: true });
    if (!mockAppStateListener) throw new Error('Expected the AppState change listener');
    mockAppStateListener('active');

    await flushPrefetch();
    expect(mockImagePrefetch).toHaveBeenCalledWith(references[0]?.uri, { cachePolicy: 'disk' });
    expect(mockNetworkListener).toBeDefined();
    expect(mockAppStateListener).toBeDefined();

    await unmount();
    expect(mockNetworkRemove).toHaveBeenCalledTimes(1);
    expect(mockAppStateRemove).toHaveBeenCalledTimes(1);
  });

  it('startet bei Mobilfunk nicht und wartet auf ein erreichbares Wi-Fi-Netz', async () => {
    const { unmount } = await renderHook(() => useBrochureImagePrefetch(references, '10115'));
    if (!resolveNetworkState) throw new Error('Expected the initial network request');
    resolveNetworkState({ type: 'CELLULAR', isConnected: true });
    expect(mockGetNetworkStateAsync).toHaveBeenCalledTimes(1);
    expect(mockImagePrefetch).not.toHaveBeenCalled();

    mockNetworkListener?.({ type: 'WIFI', isConnected: true, isInternetReachable: true });
    if (!mockAppStateListener) throw new Error('Expected the AppState change listener');
    mockAppStateListener('active');

    await flushPrefetch();
    expect(mockImagePrefetch).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('überspringt disconnected oder offline Wi-Fi und wartet im Hintergrund', async () => {
    const { unmount } = await renderHook(() => useBrochureImagePrefetch(references, '10115'));
    if (!resolveNetworkState) throw new Error('Expected the initial network request');
    resolveNetworkState({ type: 'WIFI', isConnected: false });
    expect(mockGetNetworkStateAsync).toHaveBeenCalledTimes(1);
    expect(mockImagePrefetch).not.toHaveBeenCalled();

    mockNetworkListener?.({ type: 'WIFI', isConnected: true, isInternetReachable: false });
    mockAppStateListener?.('background');
    expect(mockImagePrefetch).not.toHaveBeenCalled();

    mockNetworkListener?.({ type: 'WIFI', isConnected: true, isInternetReachable: true });
    mockAppStateListener?.('active');
    await flushPrefetch();
    expect(mockImagePrefetch).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('ignoriert einen ausstehenden Netzwerkstatus nach Wechsel der PLZ und Netzwerkfehler', async () => {
    const networkRequests: {
      resolve: (state: NetworkState) => void;
      reject: (error: Error) => void;
    }[] = [];
    mockGetNetworkStateAsync.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          networkRequests.push({ resolve, reject });
        }),
    );
    const { rerender, unmount } = await renderHook(
      ({ zip }: { zip: string }) => useBrochureImagePrefetch(references, zip),
      { initialProps: { zip: '10115' } },
    );
    const oldRequest = networkRequests[0];
    if (!oldRequest) throw new Error('Expected the original network request');

    await rerender({ zip: '20095' });
    const currentRequest = networkRequests[1];
    if (!currentRequest) throw new Error('Expected a network request for the new PLZ');

    await act(async () => {
      oldRequest.resolve({ type: 'WIFI', isConnected: true, isInternetReachable: true });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockImagePrefetch).not.toHaveBeenCalled();

    await act(async () => {
      currentRequest.reject(new Error('network unavailable'));
      await Promise.resolve();
    });
    await unmount();
  });
});
