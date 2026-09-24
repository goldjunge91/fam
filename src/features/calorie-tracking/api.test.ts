import { getSupabase } from '@/lib/backend/supabase/remote-client';
import {
  createWeightEntry,
  fetchFoodEntriesForDateRange,
  fetchWeightEntriesForLogicalDay,
  fetchWeightHistory,
  foodEntriesRangeQueryKey,
  latestWeightEntryQueryKey,
  weightEntriesQueryKey,
  weightHistoryQueryKey,
} from './api';

const mockEq = jest.fn();
const mockGte = jest.fn();
const mockLte = jest.fn();
const mockLimit = jest.fn();
const mockIs = jest.fn();
const mockOr = jest.fn();
const mockOrder = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn();

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
  or: mockOr,
  order: mockOrder,
  select: mockSelect,
  single: mockSingle,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockReturnValue(queryBuilder);
  mockGte.mockReturnValue(queryBuilder);
  mockIs.mockReturnValue(queryBuilder);
  mockLte.mockReturnValue(queryBuilder);
  mockLimit.mockReturnValue(queryBuilder);
  mockOr.mockReturnValue(queryBuilder);
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockSelect.mockReturnValue(queryBuilder);
  mockSingle.mockResolvedValue({ data: { id: 'weight-1' }, error: null });
  mockInsert.mockReturnValue(queryBuilder);
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
