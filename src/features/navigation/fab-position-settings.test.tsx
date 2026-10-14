import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  DEFAULT_FAB_POSITION,
  fabPositionQueryKey,
  getFabPosition,
  setFabPosition,
  useFabPosition,
  useSetFabPosition,
} from './fab-position-settings';

let activeQueryClient: QueryClient | undefined;

function createQueryClient() {
  activeQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
  return activeQueryClient;
}

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('FAB position setting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  afterEach(() => {
    activeQueryClient?.clear();
    activeQueryClient = undefined;
  });

  it('accepts either supported position and defaults for unknown or unreadable values', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('left');
    await expect(getFabPosition()).resolves.toBe('left');

    jest.mocked(AsyncStorage.getItem).mockResolvedValue('right');
    await expect(getFabPosition()).resolves.toBe('right');

    jest.mocked(AsyncStorage.getItem).mockResolvedValue('center');
    await expect(getFabPosition()).resolves.toBe(DEFAULT_FAB_POSITION);

    jest.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('storage unavailable'));
    await expect(getFabPosition()).resolves.toBe(DEFAULT_FAB_POSITION);
  });

  it('writes a selection but tolerates storage write failures', async () => {
    await setFabPosition('left');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@fam/fab_position', 'left');

    jest.mocked(AsyncStorage.setItem).mockRejectedValue(new Error('storage unavailable'));
    await expect(setFabPosition('right')).resolves.toBeUndefined();
  });

  it('loads the setting through React Query and invalidates it after a change', async () => {
    const queryClient = createQueryClient();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('left');
    const loaded = await renderHook(() => useFabPosition(), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(loaded.result.current.isSuccess).toBe(true));
    expect(loaded.result.current.data).toBe('left');

    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const setter = await renderHook(() => useSetFabPosition(), {
      wrapper: createWrapper(queryClient),
    });
    await setter.result.current('right');

    expect(invalidate).toHaveBeenCalledWith({ queryKey: fabPositionQueryKey });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@fam/fab_position', 'right');
  });
});
