import { renderHook } from '@testing-library/react-native';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import {
  type CreateWeightEntryInput,
  createWeightEntry,
  currentGoalQueryKey,
  type FoodEntryInput,
  fetchFoodEntriesForDateRange,
  fetchWeightEntriesForLogicalDay,
  fetchWeightHistory,
  foodEntriesQueryKey,
  foodEntriesRangeQueryKey,
  latestWeightEntryQueryKey,
  type TrackingMethod,
  useAddFoodEntryMutation,
  useAddWeightEntryMutation,
  useCurrentGoal,
  useDeleteFoodEntryMutation,
  useFoodEntries,
  useFoodEntriesForDateRange,
  useLatestWeightEntry,
  useRestoreFoodEntryMutation,
  useSetGoalMutation,
  useUpdateFoodEntryMutation,
  useUpdateTrackingDayStartTimeMutation,
  useUpdateTrackingMethodMutation,
  useWeightEntries,
  useWeightHistory,
  weightEntriesQueryKey,
  weightHistoryQueryKey,
} from './api';

const mockUseQuery = jest.fn<unknown, [unknown]>();
const mockUseMutation = jest.fn<unknown, [unknown]>();
const mockEq = jest.fn();
const mockGte = jest.fn();
const mockLte = jest.fn();
const mockLimit = jest.fn();
const mockMaybeSingle = jest.fn();
const mockUpdate = jest.fn();
const mockIs = jest.fn();
const mockOr = jest.fn();
const mockOrder = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn();
const mockQueryClient = {
  cancelQueries: jest.fn(),
  getQueryData: jest.fn(),
  setQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
};

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
  useMutation: (options: unknown) => mockUseMutation(options),
  useQueryClient: () => mockQueryClient,
}));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(),
}));

const queryBuilder = {
  eq: mockEq,
  gte: mockGte,
  insert: mockInsert,
  is: mockIs,
  lte: mockLte,
  limit: mockLimit,
  maybeSingle: mockMaybeSingle,
  or: mockOr,
  order: mockOrder,
  select: mockSelect,
  single: mockSingle,
  update: mockUpdate,
};

type QueryOptionsForTest = {
  enabled?: boolean;
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
};

type MutationOptionsForTest<TInput> = {
  mutationFn: (input: TInput) => Promise<unknown>;
  onError?: (error: unknown, variables: TInput, context?: unknown) => unknown;
  onMutate?: (variables: TInput) => Promise<unknown>;
  onSettled?: (data: unknown, error: unknown, variables: TInput) => unknown;
  onSuccess?: (data: unknown, variables: TInput) => unknown;
};

type UpdateFoodEntryInput = Partial<Omit<FoodEntryInput, 'userId' | 'loggedOn'>> & {
  id: string;
  userId: string;
  loggedOn: string;
};

function currentQueryOptions(): QueryOptionsForTest {
  return mockUseQuery.mock.calls.at(-1)?.[0] as QueryOptionsForTest;
}

function currentMutationOptions<TInput>(): MutationOptionsForTest<TInput> {
  return mockUseMutation.mock.calls.at(-1)?.[0] as MutationOptionsForTest<TInput>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockImplementation((options) => options);
  mockUseMutation.mockImplementation((options) => options);
  mockQueryClient.cancelQueries.mockResolvedValue(undefined);
  mockQueryClient.getQueryData.mockReturnValue(undefined);
  mockQueryClient.setQueryData.mockReturnValue(undefined);
  mockQueryClient.invalidateQueries.mockResolvedValue(undefined);
  mockEq.mockReturnValue(queryBuilder);
  mockGte.mockReturnValue(queryBuilder);
  mockIs.mockReturnValue(queryBuilder);
  mockLte.mockReturnValue(queryBuilder);
  mockLimit.mockReturnValue(queryBuilder);
  mockMaybeSingle.mockResolvedValue({ data: { id: 'goal-1' }, error: null });
  mockOr.mockReturnValue(queryBuilder);
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockSelect.mockReturnValue(queryBuilder);
  mockSingle.mockResolvedValue({ data: { id: 'weight-1' }, error: null });
  mockInsert.mockReturnValue(queryBuilder);
  mockUpdate.mockReturnValue(queryBuilder);
  mockFrom.mockReturnValue(queryBuilder);
  jest
    .mocked(getSupabase)
    .mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabase>);
});

it('trennt Gewichtsabfragen nach Nutzer, Profil, logischem Datum und Tagesstart', () => {
  expect(weightEntriesQueryKey('user-1', 'child-1', '2026-08-18', '06:00')).toEqual([
    'calorie-tracking',
    'weight',
    'user-1',
    'child-1',
    'logical-day',
    '2026-08-18',
    '06:00',
  ]);
  expect(latestWeightEntryQueryKey('user-1')).toEqual([
    'calorie-tracking',
    'weight',
    'latest',
    'user-1',
  ]);
});

it('liest die persönliche Gewichtshistorie begrenzt und absteigend', async () => {
  const entries = [{ id: 'weight-2', measured_on: '2026-08-19', weight_kg: 80.5 }];
  mockOrder.mockResolvedValue({ data: entries, error: null });

  expect(weightHistoryQueryKey('user-1')).toEqual([
    'calorie-tracking',
    'weight',
    'user-1',
    null,
    'history',
  ]);
  await expect(fetchWeightHistory({ userId: 'user-1' })).resolves.toEqual(entries);

  expect(mockLimit).toHaveBeenCalledWith(90);
  expect(mockOrder).toHaveBeenCalledWith('measured_on', { ascending: false });
  expect(mockIs).toHaveBeenCalledWith('child_profile_id', null);
});

it('liest Ernährungseinträge für den 14-Tage-Kalenderbereich', async () => {
  const entries = [{ id: 'food-1', logged_on: '2026-08-18', kcal: 640 }];
  mockOrder.mockResolvedValue({ data: entries, error: null });

  expect(foodEntriesRangeQueryKey('user-1', '2026-08-06', '2026-08-19', null)).toEqual([
    'calorie-tracking',
    'food-entries-range',
    'user-1',
    null,
    '2026-08-06',
    '2026-08-19',
  ]);

  await expect(
    fetchFoodEntriesForDateRange({
      userId: 'user-1',
      fromDate: '2026-08-06',
      toDate: '2026-08-19',
    }),
  ).resolves.toEqual(entries);

  expect(mockFrom).toHaveBeenCalledWith('food_entries');
  expect(mockGte).toHaveBeenCalledWith('logged_on', '2026-08-06');
  expect(mockLte).toHaveBeenCalledWith('logged_on', '2026-08-19');
  expect(mockIs).toHaveBeenCalledWith('deleted_at', null);
  expect(mockIs).toHaveBeenCalledWith('child_profile_id', null);
  expect(mockOrder).toHaveBeenCalledWith('logged_on', { ascending: true });
});

it('liest neue Messungen halb-offen und behaelt measured_on als Legacy-Fallback', async () => {
  await fetchWeightEntriesForLogicalDay({
    userId: 'user-1',
    childProfileId: null,
    logicalDate: '2026-08-18',
    dayStartTime: '06:00',
  });

  expect(mockFrom).toHaveBeenCalledWith('weight_entries');
  expect(mockIs).toHaveBeenCalledWith('child_profile_id', null);
  expect(mockOr).toHaveBeenCalledTimes(1);

  const filter = mockOr.mock.calls[0][0] as string;
  expect(filter).toContain('measured_at.is.null,measured_on.eq.2026-08-18');

  const range = filter.match(/measured_at\.gte\.([^,]+),measured_at\.lt\.([^)]*)\)/);
  expect(range).not.toBeNull();

  const start = new Date(range?.[1] ?? 'invalid');
  const nextStart = new Date(range?.[2] ?? 'invalid');
  expect([
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
    start.getHours(),
    start.getMinutes(),
  ]).toEqual([2026, 7, 18, 6, 0]);
  expect([
    nextStart.getFullYear(),
    nextStart.getMonth(),
    nextStart.getDate(),
    nextStart.getHours(),
    nextStart.getMinutes(),
  ]).toEqual([2026, 7, 19, 6, 0]);
});

it('schreibt fuer neue Eintraege echten Messzeitpunkt und logisches Datum', async () => {
  const measuredAt = new Date(2026, 7, 18, 5, 15).toISOString();

  await createWeightEntry({
    userId: 'user-1',
    childProfileId: null,
    weightKg: 81.2,
    measuredAt,
    dayStartTime: '06:00',
  });

  expect(mockInsert).toHaveBeenCalledWith({
    user_id: 'user-1',
    child_profile_id: null,
    weight_kg: 81.2,
    measured_at: measuredAt,
    measured_on: '2026-08-17',
  });
});

it('weist einen ungueltigen Messzeitpunkt vor dem Datenbankaufruf zurueck', async () => {
  await expect(
    createWeightEntry({
      userId: 'user-1',
      weightKg: 81.2,
      measuredAt: 'kein-zeitpunkt',
      dayStartTime: '06:00',
    }),
  ).rejects.toThrow();

  expect(mockInsert).not.toHaveBeenCalled();
});

it('liest das aktuelle Ziel fuer Nutzer und Kind und behandelt Query-Fehler', async () => {
  expect(currentGoalQueryKey('user-1')).toEqual([
    'calorie-tracking',
    'goal',
    'current',
    'user-1',
    null,
  ]);

  await renderHook(() => useCurrentGoal(undefined));
  expect(currentQueryOptions().enabled).toBe(false);

  await renderHook(() => useCurrentGoal('user-1'));
  const options = currentQueryOptions();
  expect(options.enabled).toBe(true);
  expect(options.queryKey).toEqual(currentGoalQueryKey('user-1'));
  mockOrder.mockReturnValueOnce(queryBuilder);
  await expect(options.queryFn()).resolves.toEqual({ id: 'goal-1' });
  expect(mockIs).toHaveBeenCalledWith('child_profile_id', null);

  await renderHook(() => useCurrentGoal('user-1', 'child-1'));
  mockOrder.mockReturnValueOnce(queryBuilder);
  await currentQueryOptions().queryFn();
  expect(mockEq).toHaveBeenCalledWith('child_profile_id', 'child-1');

  mockOrder.mockReturnValueOnce(queryBuilder);
  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'goal unavailable' } });
  await expect(currentQueryOptions().queryFn()).rejects.toThrow('goal unavailable');
});

it('fragt Gewichtseinträge über die Hooks ab und behandelt Fehler', async () => {
  await renderHook(() => useWeightEntries(undefined, null, '', '00:00'));
  expect(currentQueryOptions().enabled).toBe(false);

  await renderHook(() => useWeightEntries('user-1', 'child-1', '2026-08-18', '06:00'));
  const daily = currentQueryOptions();
  expect(daily.enabled).toBe(true);
  expect(daily.queryKey).toEqual(weightEntriesQueryKey('user-1', 'child-1', '2026-08-18', '06:00'));
  await daily.queryFn();
  expect(mockEq).toHaveBeenCalledWith('child_profile_id', 'child-1');

  mockOrder.mockResolvedValueOnce({ data: null, error: null });
  await expect(
    fetchWeightEntriesForLogicalDay({
      userId: 'user-1',
      logicalDate: '2026-08-18',
      dayStartTime: '06:00',
    }),
  ).resolves.toEqual([]);
  mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'weight unavailable' } });
  await expect(
    fetchWeightEntriesForLogicalDay({
      userId: 'user-1',
      logicalDate: '2026-08-18',
      dayStartTime: '06:00',
    }),
  ).rejects.toThrow('weight unavailable');

  await renderHook(() => useWeightHistory(undefined));
  expect(currentQueryOptions().enabled).toBe(false);
  await renderHook(() => useWeightHistory('user-1', 'child-1'));
  const history = currentQueryOptions();
  expect(history.enabled).toBe(true);
  await history.queryFn();
  expect(mockEq).toHaveBeenCalledWith('child_profile_id', 'child-1');
  mockOrder.mockResolvedValueOnce({ data: null, error: null });
  await expect(
    fetchWeightHistory({ userId: 'user-1', childProfileId: 'child-1' }),
  ).resolves.toEqual([]);
  mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'history unavailable' } });
  await expect(fetchWeightHistory({ userId: 'user-1' })).rejects.toThrow('history unavailable');

  await renderHook(() => useLatestWeightEntry(undefined));
  expect(currentQueryOptions().enabled).toBe(false);
  await renderHook(() => useLatestWeightEntry('user-1'));
  const latest = currentQueryOptions();
  expect(latest.enabled).toBe(true);
  mockOrder.mockReturnValueOnce(queryBuilder);
  await expect(latest.queryFn()).resolves.toEqual({ id: 'goal-1' });
  mockOrder.mockReturnValueOnce(queryBuilder);
  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'latest unavailable' } });
  await expect(latest.queryFn()).rejects.toThrow('latest unavailable');
});

it('speichert Ziele und Messungen und invalidiert die betroffenen Abfragen', async () => {
  const goalInput = {
    userId: 'user-1',
    goalType: 'lose' as const,
    rateKgPerWeek: 0.5,
    dailyKcal: 1800,
    proteinG: 130,
    carbsG: 180,
    fatG: 60,
  };
  await renderHook(() => useSetGoalMutation());
  const setGoal = currentMutationOptions<typeof goalInput>();
  await setGoal.mutationFn(goalInput);
  expect(mockInsert).toHaveBeenCalledWith({
    user_id: 'user-1',
    goal_type: 'lose',
    rate_kg_per_week: 0.5,
    daily_kcal: 1800,
    protein_g: 130,
    carbs_g: 180,
    fat_g: 60,
    net_carbs_g: null,
    target_weight_kg: null,
    child_profile_id: null,
  });
  setGoal.onSuccess?.(undefined, goalInput);
  expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: currentGoalQueryKey('user-1'),
  });
  mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'goal insert failed' } });
  await expect(setGoal.mutationFn(goalInput)).rejects.toThrow('goal insert failed');

  const weightInput: CreateWeightEntryInput = {
    userId: 'user-1',
    weightKg: 81,
    measuredAt: '2026-08-18T05:15:00.000Z',
  };
  await renderHook(() => useAddWeightEntryMutation());
  const addWeight = currentMutationOptions<CreateWeightEntryInput>();
  await addWeight.mutationFn(weightInput);
  expect(mockInsert).toHaveBeenCalledWith({
    user_id: 'user-1',
    child_profile_id: null,
    weight_kg: 81,
    measured_at: '2026-08-18T05:15:00.000Z',
    measured_on: '2026-08-18',
  });
  addWeight.onSuccess?.(undefined, weightInput);
  expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: latestWeightEntryQueryKey('user-1'),
  });

  mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'weight insert failed' } });
  await expect(addWeight.mutationFn(weightInput)).rejects.toThrow('weight insert failed');
});

it('liest Ernährungseinträge eines Tages und eines Datumsbereichs', async () => {
  expect(foodEntriesQueryKey('user-1', '2026-08-18')).toEqual([
    'calorie-tracking',
    'food-entries',
    'user-1',
    '2026-08-18',
    null,
  ]);

  await renderHook(() => useFoodEntries(undefined, '2026-08-18'));
  expect(currentQueryOptions().enabled).toBe(false);
  await renderHook(() => useFoodEntries('user-1', ''));
  expect(currentQueryOptions().enabled).toBe(false);
  await renderHook(() => useFoodEntries('user-1', '2026-08-18', 'child-1'));
  const day = currentQueryOptions();
  expect(day.enabled).toBe(true);
  mockOrder.mockResolvedValueOnce({ data: [{ id: 'food-1' }], error: null });
  await expect(day.queryFn()).resolves.toEqual([{ id: 'food-1' }]);
  expect(mockEq).toHaveBeenCalledWith('child_profile_id', 'child-1');
  mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'food unavailable' } });
  await expect(day.queryFn()).rejects.toThrow('food unavailable');

  await renderHook(() => useFoodEntriesForDateRange(undefined, '', ''));
  expect(currentQueryOptions().enabled).toBe(false);
  await renderHook(() => useFoodEntriesForDateRange('user-1', '2026-08-06', '2026-08-19'));
  const range = currentQueryOptions();
  expect(range.enabled).toBe(true);
  mockOrder.mockResolvedValueOnce({ data: null, error: null });
  await expect(range.queryFn()).resolves.toEqual([]);
  mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'range unavailable' } });
  await expect(range.queryFn()).rejects.toThrow('range unavailable');
});

it('fügt Ernährungseinträge mit Standardwerten hinzu und behandelt Fehler', async () => {
  const input: FoodEntryInput = {
    userId: 'user-1',
    loggedOn: '2026-08-18',
    mealType: 'lunch',
    name: 'Salat',
    quantity: 1,
    unit: 'portion',
    kcal: 320,
    proteinG: 12,
    carbsG: 35,
    fatG: 14,
  };
  await renderHook(() => useAddFoodEntryMutation());
  const addFood = currentMutationOptions<FoodEntryInput>();
  await addFood.mutationFn(input);
  expect(mockInsert).toHaveBeenCalledWith({
    user_id: 'user-1',
    logged_on: '2026-08-18',
    logged_at: expect.any(String),
    meal_type: 'lunch',
    name: 'Salat',
    quantity: 1,
    unit: 'portion',
    kcal: 320,
    protein_g: 12,
    carbs_g: 35,
    fat_g: 14,
    fiber_g: null,
    product_id: null,
    child_profile_id: null,
  });
  addFood.onSuccess?.(undefined, input);
  expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: foodEntriesQueryKey('user-1', '2026-08-18'),
  });

  const childInput = { ...input, childProfileId: 'child-1', loggedAt: '2026-08-18T12:00:00Z' };
  await addFood.mutationFn(childInput);
  expect(mockInsert).toHaveBeenLastCalledWith(
    expect.objectContaining({
      logged_at: '2026-08-18T12:00:00Z',
      child_profile_id: 'child-1',
    }),
  );
  mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'food insert failed' } });
  await expect(addFood.mutationFn(input)).rejects.toThrow('food insert failed');
});

it('aktualisiert optionale Ernährungswerte und kann sie unverändert lassen', async () => {
  const input = {
    id: 'food-1',
    userId: 'user-1',
    loggedOn: '2026-08-18',
    mealType: 'dinner' as const,
    name: 'Bowl',
    quantity: 2,
    unit: 'portion',
    kcal: 500,
    proteinG: 20,
    carbsG: 55,
    fatG: 18,
    fiberG: 8,
    productId: 'product-1',
    childProfileId: 'child-1',
  };
  await renderHook(() => useUpdateFoodEntryMutation());
  const updateFood = currentMutationOptions<UpdateFoodEntryInput>();
  await updateFood.mutationFn(input);
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      meal_type: 'dinner',
      name: 'Bowl',
      quantity: 2,
      unit: 'portion',
      kcal: 500,
      protein_g: 20,
      carbs_g: 55,
      fat_g: 18,
      fiber_g: 8,
      product_id: 'product-1',
    }),
  );
  updateFood.onSuccess?.(undefined, input);
  expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: foodEntriesQueryKey('user-1', '2026-08-18', 'child-1'),
  });

  mockUpdate.mockClear();
  const unchangedInput = { id: 'food-1', userId: 'user-1', loggedOn: '2026-08-18' };
  await updateFood.mutationFn(unchangedInput);
  const unchangedUpdates = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(unchangedUpdates).toEqual({ updated_at: expect.any(String) });

  mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'food update failed' } });
  await expect(updateFood.mutationFn(unchangedInput)).rejects.toThrow('food update failed');
});

it('löscht und stellt Ernährungseinträge per Soft-Delete wieder her', async () => {
  const input = { id: 'food-1', userId: 'user-1', loggedOn: '2026-08-18' };
  await renderHook(() => useDeleteFoodEntryMutation());
  const removeFood = currentMutationOptions<typeof input>();
  await removeFood.mutationFn(input);
  expect(mockUpdate).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
  removeFood.onSuccess?.(undefined, input);

  await renderHook(() => useRestoreFoodEntryMutation());
  const restoreFood = currentMutationOptions<typeof input>();
  await restoreFood.mutationFn(input);
  expect(mockUpdate).toHaveBeenLastCalledWith({ deleted_at: null });
  restoreFood.onSuccess?.(undefined, input);

  mockEq.mockResolvedValueOnce({ data: null, error: { message: 'delete failed' } });
  await expect(removeFood.mutationFn(input)).rejects.toThrow('delete failed');
  mockEq.mockResolvedValueOnce({ data: null, error: { message: 'restore failed' } });
  await expect(restoreFood.mutationFn(input)).rejects.toThrow('restore failed');
});

it('aktualisiert Tagesstart und Tracking-Methode optimistisch und rollt Fehler zurück', async () => {
  const dayStartInput = { userId: 'user-1', time: '05:30' };
  const previousProfile = { id: 'user-1', tracking_day_start_time: '00:00' };
  await renderHook(() => useUpdateTrackingDayStartTimeMutation());
  const updateDayStart = currentMutationOptions<typeof dayStartInput>();
  mockQueryClient.getQueryData.mockReturnValueOnce(previousProfile);
  const dayStartContext = await updateDayStart.onMutate?.(dayStartInput);
  const dayStartUpdater = mockQueryClient.setQueryData.mock.calls.at(-1)?.[1] as (
    old: Record<string, unknown> | undefined,
  ) => Record<string, unknown> | undefined;
  expect(dayStartUpdater(previousProfile)).toEqual({
    ...previousProfile,
    tracking_day_start_time: '05:30',
  });
  expect(dayStartUpdater(undefined)).toBeUndefined();
  updateDayStart.onError?.(new Error('save failed'), dayStartInput, dayStartContext);
  expect(mockQueryClient.setQueryData).toHaveBeenLastCalledWith(
    ['profile', 'user-1'],
    previousProfile,
  );
  updateDayStart.onSettled?.(undefined, null, dayStartInput);
  expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['profile', 'user-1'],
  });
  await updateDayStart.mutationFn(dayStartInput);
  mockEq.mockResolvedValueOnce({ error: { message: 'profile update failed' } });
  await expect(updateDayStart.mutationFn(dayStartInput)).rejects.toThrow('profile update failed');
  updateDayStart.onError?.(new Error('failed'), dayStartInput, {
    previous: undefined,
    queryKey: ['profile', 'user-1'],
  });
  expect(mockQueryClient.setQueryData).not.toHaveBeenCalledWith(['profile', 'user-1'], undefined);

  const methodInput: { userId: string; method: TrackingMethod } = {
    userId: 'user-1',
    method: 'glp1',
  };
  const methodProfile = { id: 'user-1', tracking_method: 'standard' };
  await renderHook(() => useUpdateTrackingMethodMutation());
  const updateMethod = currentMutationOptions<typeof methodInput>();
  mockQueryClient.getQueryData.mockReturnValueOnce(methodProfile);
  const methodContext = await updateMethod.onMutate?.(methodInput);
  const methodUpdater = mockQueryClient.setQueryData.mock.calls.at(-1)?.[1] as (
    old: Record<string, unknown> | undefined,
  ) => Record<string, unknown> | undefined;
  expect(methodUpdater(methodProfile)).toEqual({ ...methodProfile, tracking_method: 'glp1' });
  updateMethod.onError?.(new Error('save failed'), methodInput, methodContext);
  expect(mockQueryClient.setQueryData).toHaveBeenLastCalledWith(
    ['profile', 'user-1'],
    methodProfile,
  );
  updateMethod.onSettled?.(undefined, null, methodInput);
  await updateMethod.mutationFn(methodInput);
  mockEq.mockResolvedValueOnce({ error: { message: 'method update failed' } });
  await expect(updateMethod.mutationFn(methodInput)).rejects.toThrow('method update failed');
});
