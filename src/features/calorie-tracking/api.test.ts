import { getSupabase } from '@/lib/supabase';
import {
  createWeightEntry,
  fetchWeightEntriesForLogicalDay,
  latestWeightEntryQueryKey,
  weightEntriesQueryKey,
} from './api';

const mockEq = jest.fn();
const mockIs = jest.fn();
const mockOr = jest.fn();
const mockOrder = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

const queryBuilder = {
  eq: mockEq,
  insert: mockInsert,
  is: mockIs,
  or: mockOr,
  order: mockOrder,
  select: mockSelect,
  single: mockSingle,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockReturnValue(queryBuilder);
  mockIs.mockReturnValue(queryBuilder);
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
