import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { DEFAULT_PORTIONS_PER_PERSON } from './servings';
import {
  getPortionsPerPerson,
  portionsPerPersonQueryKey,
  setPortionsPerPerson,
  usePortionsPerPerson,
  useSetPortionsPerPerson,
} from './settings';

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

describe('meal planner portions setting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  afterEach(() => {
    activeQueryClient?.clear();
    activeQueryClient = undefined;
  });

  it('uses the default for missing, invalid, and unreadable values', async () => {
    await expect(getPortionsPerPerson()).resolves.toBe(DEFAULT_PORTIONS_PER_PERSON);

    jest.mocked(AsyncStorage.getItem).mockResolvedValue('not-a-number');
    await expect(getPortionsPerPerson()).resolves.toBe(DEFAULT_PORTIONS_PER_PERSON);

    jest.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('storage unavailable'));
    await expect(getPortionsPerPerson()).resolves.toBe(DEFAULT_PORTIONS_PER_PERSON);
  });

  it('reads and writes a positive portion count while tolerating storage write failures', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('2.5');
    await expect(getPortionsPerPerson()).resolves.toBe(2.5);

    await setPortionsPerPerson(3);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@fam/meal_planner_portions_per_person', '3');

    jest.mocked(AsyncStorage.setItem).mockRejectedValue(new Error('storage unavailable'));
    await expect(setPortionsPerPerson(4)).resolves.toBeUndefined();
  });

  it('rejects non-finite and non-positive values', async () => {
    await expect(setPortionsPerPerson(Number.POSITIVE_INFINITY)).rejects.toThrow(
      'portionsPerPerson muss positiv sein',
    );
    await expect(setPortionsPerPerson(0)).rejects.toThrow('portionsPerPerson muss positiv sein');
  });

  it('loads the setting through React Query and invalidates it after a change', async () => {
    const queryClient = createQueryClient();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('5');
    const loaded = await renderHook(() => usePortionsPerPerson(), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(loaded.result.current.isSuccess).toBe(true));
    expect(loaded.result.current.data).toBe(5);

    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const setter = await renderHook(() => useSetPortionsPerPerson(), {
      wrapper: createWrapper(queryClient),
    });
    await setter.result.current(2);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: portionsPerPersonQueryKey });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@fam/meal_planner_portions_per_person', '2');
  });
});
