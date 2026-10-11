import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import {
  fetchLatestProfileWeight,
  profileLatestWeightQueryKey,
  useLatestProfileWeight,
} from '@/features/profile/biometrics-api';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import {
  profileLatestWeightQueryKey as androidProfileLatestWeightQueryKey,
  fetchLatestProfileWeight as fetchAndroidLatestProfileWeight,
  useLatestProfileWeight as useAndroidLatestProfileWeight,
} from './biometrics-api.android';

const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(),
}));

const queryBuilder = {
  eq: mockEq,
  maybeSingle: mockMaybeSingle,
  select: mockSelect,
};

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockReturnValue(queryBuilder);
  mockSelect.mockReturnValue(queryBuilder);
  mockMaybeSingle.mockResolvedValue({ data: { id: 'weight-latest' }, error: null });
  mockFrom.mockReturnValue(queryBuilder);
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
  jest
    .mocked(getSupabase)
    .mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabase>);
});

afterEach(() => queryClient.clear());

test('liest das einmalige Profilgewicht des Account-Nutzers', async () => {
  mockMaybeSingle.mockResolvedValue({ data: { weight_kg: 80.5 }, error: null });

  await expect(fetchLatestProfileWeight('user-1')).resolves.toBe(80.5);

  expect(mockFrom).toHaveBeenCalledWith('profiles');
  expect(mockSelect).toHaveBeenCalledWith('weight_kg');
  expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
});

test('liefert null für fehlendes Profilgewicht und gibt Datenbankfehler weiter', async () => {
  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
  await expect(fetchLatestProfileWeight('user-empty')).resolves.toBeNull();

  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  await expect(fetchLatestProfileWeight('user-offline')).rejects.toThrow('offline');
});

test('verwendet einen profil-spezifischen Cache-Key', () => {
  expect(profileLatestWeightQueryKey('user-1')).toEqual(['profile', 'latest-weight', 'user-1']);
  expect(profileLatestWeightQueryKey(undefined)).toEqual(['profile', 'latest-weight', undefined]);
});

test('deaktiviert die Gewichtsabfrage ohne Nutzerkennung', async () => {
  const { result } = await renderHook(() => useLatestProfileWeight(undefined), { wrapper });

  expect(result.current.fetchStatus).toBe('idle');
  expect(mockFrom).not.toHaveBeenCalled();
});

test('lädt das Profilgewicht über React Query', async () => {
  mockMaybeSingle.mockResolvedValue({ data: { weight_kg: 76.3 }, error: null });

  const { result } = await renderHook(() => useLatestProfileWeight('user-web'), { wrapper });

  await waitFor(() => expect(result.current.data).toBe(76.3));
});

test('Android lädt Gewicht, behandelt fehlende Werte und reicht Datenbankfehler weiter', async () => {
  expect(androidProfileLatestWeightQueryKey(undefined)).toEqual([
    'profile',
    'latest-weight',
    undefined,
  ]);

  mockMaybeSingle.mockResolvedValueOnce({ data: { weight_kg: 71.2 }, error: null });
  await expect(fetchAndroidLatestProfileWeight('user-android')).resolves.toBe(71.2);

  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
  await expect(fetchAndroidLatestProfileWeight('user-android')).resolves.toBeNull();

  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  await expect(fetchAndroidLatestProfileWeight('user-android')).rejects.toThrow('offline');
});

test('Android bindet das neueste Profilgewicht über React Query ein', async () => {
  mockMaybeSingle.mockResolvedValue({ data: { weight_kg: 68.4 }, error: null });

  const { result } = await renderHook(() => useAndroidLatestProfileWeight('user-android'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.data).toBe(68.4));
});
