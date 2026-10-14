import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { createCustomFoodSelection } from '@/features/profile/domain/food-rules';
import {
  fetchProfileFoodRules,
  profileFoodRulesQueryKey,
  saveProfileFoodRules,
  useProfileFoodRules,
} from '@/features/profile/food-rules-api';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import {
  profileFoodRulesQueryKey as androidProfileFoodRulesQueryKey,
  fetchProfileFoodRules as fetchAndroidProfileFoodRules,
  saveProfileFoodRules as saveAndroidProfileFoodRules,
  useProfileFoodRules as useAndroidProfileFoodRules,
} from './food-rules-api.android';

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockUpsert = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(),
}));

const queryBuilder = {
  eq: mockEq,
  maybeSingle: mockMaybeSingle,
  select: mockSelect,
  upsert: mockUpsert,
};

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockReturnValue(queryBuilder);
  mockSelect.mockReturnValue(queryBuilder);
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockUpsert.mockResolvedValue({ error: null });
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

test('trennt Lebensmittelregeln im Query-Cache nach Account', () => {
  expect(profileFoodRulesQueryKey('user-1')).toEqual(['profile-food-rules', 'user-1']);
});

test('führt die Abfrage nur mit einer Account-ID aus', async () => {
  const disabled = await renderHook(() => useProfileFoodRules(undefined), { wrapper });
  expect(disabled.result.current.fetchStatus).toBe('idle');
  expect(mockFrom).not.toHaveBeenCalled();

  await disabled.unmount();
  const enabled = await renderHook(() => useProfileFoodRules('user-1'), { wrapper });
  await waitFor(() => expect(enabled.result.current.isSuccess).toBe(true));
  expect(enabled.result.current.data).toEqual({
    allergies: [],
    intolerances: [],
    dislikedFoods: [],
  });
  expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
  await enabled.unmount();
});

test('liefert leere Regeln, solange noch keine Zeile gespeichert wurde', async () => {
  await expect(fetchProfileFoodRules('user-1')).resolves.toEqual({
    allergies: [],
    intolerances: [],
    dislikedFoods: [],
  });

  expect(mockFrom).toHaveBeenCalledWith('profile_food_rules');
  expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
});

test('liest gespeicherte Codes und freie Einträge in den logischen Vertrag', async () => {
  mockMaybeSingle.mockResolvedValueOnce({
    data: {
      allergy_codes: ['peanuts'],
      custom_allergies: ['Johannisbrot'],
      intolerance_codes: ['lactose'],
      custom_intolerances: ['Histamin'],
      disliked_foods: ['Oliven'],
    },
    error: null,
  });

  await expect(fetchProfileFoodRules('user-1')).resolves.toEqual({
    allergies: [{ source: 'preset', code: 'peanuts' }, createCustomFoodSelection('Johannisbrot')],
    intolerances: [{ source: 'preset', code: 'lactose' }, createCustomFoodSelection('Histamin')],
    dislikedFoods: [createCustomFoodSelection('Oliven')],
  });
});

test('speichert alle drei Kategorien gemeinsam per Upsert', async () => {
  await saveProfileFoodRules('user-1', {
    allergies: [{ source: 'preset', code: 'peanuts' }, createCustomFoodSelection('Johannisbrot')],
    intolerances: [{ source: 'preset', code: 'lactose' }],
    dislikedFoods: [createCustomFoodSelection('Oliven')],
  });

  expect(mockUpsert).toHaveBeenCalledWith(
    {
      user_id: 'user-1',
      allergy_codes: ['peanuts'],
      custom_allergies: ['Johannisbrot'],
      intolerance_codes: ['lactose'],
      custom_intolerances: [],
      disliked_foods: ['Oliven'],
    },
    { onConflict: 'user_id' },
  );
});

test('reicht Datenbankfehler beim Speichern weiter', async () => {
  mockUpsert.mockResolvedValueOnce({ error: { message: 'permission denied' } });

  await expect(
    saveProfileFoodRules('user-1', {
      allergies: [],
      intolerances: [],
      dislikedFoods: [],
    }),
  ).rejects.toThrow('permission denied');
});

test('Android liest gespeicherte Regeln, leere Zeilen und Datenbankfehler', async () => {
  expect(androidProfileFoodRulesQueryKey('user-android')).toEqual([
    'profile-food-rules',
    'user-android',
  ]);

  await expect(fetchAndroidProfileFoodRules('user-android')).resolves.toEqual({
    allergies: [],
    intolerances: [],
    dislikedFoods: [],
  });

  mockMaybeSingle.mockResolvedValueOnce({
    data: {
      allergy_codes: ['peanuts'],
      custom_allergies: [],
      intolerance_codes: [],
      custom_intolerances: [],
      disliked_foods: [],
    },
    error: null,
  });
  await expect(fetchAndroidProfileFoodRules('user-android')).resolves.toMatchObject({
    allergies: [{ source: 'preset', code: 'peanuts' }],
  });

  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  await expect(fetchAndroidProfileFoodRules('user-android')).rejects.toThrow('offline');
});

test('Android bindet die Regelabfrage ein und speichert alle Kategorien per Upsert', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  const { result } = await renderHook(() => useAndroidProfileFoodRules('user-android'), {
    wrapper,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.allergies).toEqual([]);

  await saveAndroidProfileFoodRules('user-android', {
    allergies: [createCustomFoodSelection('Sesam')],
    intolerances: [],
    dislikedFoods: [],
  });
  expect(mockUpsert).toHaveBeenLastCalledWith(
    {
      user_id: 'user-android',
      allergy_codes: [],
      custom_allergies: ['Sesam'],
      intolerance_codes: [],
      custom_intolerances: [],
      disliked_foods: [],
    },
    { onConflict: 'user_id' },
  );

  mockUpsert.mockResolvedValueOnce({ error: { message: 'permission denied' } });
  await expect(
    saveAndroidProfileFoodRules('user-android', {
      allergies: [],
      intolerances: [],
      dislikedFoods: [],
    }),
  ).rejects.toThrow('permission denied');
});
