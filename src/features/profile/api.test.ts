import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { updateProfile, useProfile } from '@/features/profile/api';
import { getSupabase } from '@/lib/backend/supabase/remote-client';

const mockEq = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(),
}));

const queryBuilder = {
  eq: mockEq,
  select: mockSelect,
  single: mockSingle,
  update: mockUpdate,
};

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockReturnValue(queryBuilder);
  mockFrom.mockReturnValue(queryBuilder);
  mockSelect.mockReturnValue(queryBuilder);
  mockSingle.mockResolvedValue({ data: { id: 'user-1', display_name: 'Marco' }, error: null });
  mockUpdate.mockReturnValue(queryBuilder);
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

test('lädt das Profil des Accounts und deaktiviert die Abfrage ohne Account-ID', async () => {
  const loaded = await renderHook(() => useProfile('user-1'), { wrapper });
  await waitFor(() => expect(loaded.result.current.data?.display_name).toBe('Marco'));
  expect(mockFrom).toHaveBeenCalledWith('profiles');
  expect(mockSelect).toHaveBeenCalledWith('*');
  expect(mockEq).toHaveBeenCalledWith('id', 'user-1');

  const disabled = await renderHook(() => useProfile(undefined), { wrapper });
  expect(disabled.result.current.fetchStatus).toBe('idle');
  expect(mockSingle).toHaveBeenCalledTimes(1);
});

test('gibt Ladefehler weiter und beendet den Versuch bei einem fehlenden Profil', async () => {
  mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
  const orphaned = await renderHook(() => useProfile('orphaned-user'), { wrapper });
  await waitFor(() => expect(orphaned.result.current.isError).toBe(true));
  expect(mockSingle).toHaveBeenCalledTimes(1);

  mockSingle.mockResolvedValue({ data: null, error: { message: 'temporarily unavailable' } });
  const failed = await renderHook(() => useProfile('failing-user'), { wrapper });
  await waitFor(() => expect(failed.result.current.isError).toBe(true), { timeout: 5000 });
  expect(mockSingle).toHaveBeenCalledTimes(4);
});

test('validiert und übersetzt Profiländerungen vor dem Supabase-Update', async () => {
  mockEq.mockResolvedValueOnce({ error: null });
  await expect(
    updateProfile('user-1', {
      displayName: '  Marco  ',
      birthDate: '15.05.1990',
      sex: 'male',
      heightCm: 182,
      weightKg: 82,
      activityLevel: 'active',
      avatarUrl: 'https://example.com/avatar.png',
    }),
  ).resolves.toEqual({ error: null });
  expect(mockUpdate).toHaveBeenCalledWith({
    display_name: 'Marco',
    birth_date: '1990-05-15',
    sex: 'male',
    height_cm: 182,
    weight_kg: 82,
    activity_level: 'active',
    avatar_url: 'https://example.com/avatar.png',
  });
  expect(mockEq).toHaveBeenCalledWith('id', 'user-1');

  await expect(updateProfile('user-1', { displayName: '   ' })).rejects.toThrow();
  expect(mockUpdate).toHaveBeenCalledTimes(1);
});
