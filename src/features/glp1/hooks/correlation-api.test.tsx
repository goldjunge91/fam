import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getDatabase } from '@/lib/db/client';
import { getSupabase } from '@/lib/supabase';
import { correlationSeriesQueryKey, useCorrelationSeries } from './correlation-api';

const mockGetAllAsync = jest.fn();
const mockFrom = jest.fn();
let foodQuery: ReturnType<typeof remoteQuery>;
let weightQuery: ReturnType<typeof remoteQuery>;

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

function remoteQuery(data: unknown[] = [], error: { message: string } | null = null) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    or: jest.fn(),
    order: jest.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockResolvedValue({ data, error });
  return query;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllAsync.mockResolvedValue([]);
  jest.mocked(getDatabase).mockResolvedValue({
    getAllAsync: mockGetAllAsync,
  } as unknown as Awaited<ReturnType<typeof getDatabase>>);

  foodQuery = remoteQuery([{ logged_on: '2026-08-30', kcal: 1_250 }]);
  weightQuery = remoteQuery([{ measured_on: '2026-08-30', measured_at: null, weight_kg: 91.4 }]);
  mockFrom.mockImplementation((table: string) =>
    table === 'food_entries' ? foodQuery : weightQuery,
  );
  jest
    .mocked(getSupabase)
    .mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabase>);
});

it('liefert eine 90-Tage-Serie und trennt den Cache nach Scope und Tagesstart', async () => {
  const queryClient = createQueryClient();
  const { result } = await renderHook(
    () => useCorrelationSeries('user-1', null, '2026-08-30', '06:00'),
    {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    },
  );

  await waitFor(() => expect(result.current.data).toHaveLength(90));
  expect(result.current.data?.[0]?.date).toBe('2026-06-02');
  expect(result.current.data?.at(-1)).toEqual(
    expect.objectContaining({ date: '2026-08-30', calories: 1_250, weightKg: 91.4 }),
  );
  expect(
    queryClient.getQueryData(correlationSeriesQueryKey('user-1', null, '2026-08-30', '06:00')),
  ).toBe(result.current.data);
  expect(foodQuery.is).toHaveBeenCalledWith('child_profile_id', null);
  expect(foodQuery.gte).toHaveBeenCalledWith('logged_on', '2026-06-02');
  expect(foodQuery.lte).toHaveBeenCalledWith('logged_on', '2026-08-30');
  expect(weightQuery.is).toHaveBeenCalledWith('child_profile_id', null);
});

it('nutzt die letzte Injektion vor dem Fenster und filtert Account und Kind strikt', async () => {
  mockGetAllAsync
    .mockResolvedValueOnce([
      {
        administered_at: '2026-06-02T09:00:00.000Z',
        medication_name: 'Mounjaro',
        dose: 5,
        unit: 'mg',
        injection_site: 'thigh',
      },
    ])
    .mockResolvedValueOnce([
      {
        administered_at: '2026-05-26T09:00:00.000Z',
        medication_name: 'Mounjaro',
        dose: 2.5,
        unit: 'mg',
        injection_site: null,
      },
    ]);
  const queryClient = createQueryClient();
  const { result } = await renderHook(
    () => useCorrelationSeries('user-1', 'child-1', '2026-08-30', '06:00'),
    {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    },
  );

  await waitFor(() => expect(result.current.data?.[0]?.doseChanged).toBe(true));
  expect(result.current.data?.[0]).toEqual(
    expect.objectContaining({
      date: '2026-06-02',
      daysSinceInjection: 0,
      injection: expect.objectContaining({ dose: 5, unit: 'mg' }),
    }),
  );

  const [rangeSql, rangeParams] = mockGetAllAsync.mock.calls[0];
  const [previousSql, previousParams] = mockGetAllAsync.mock.calls[1];
  expect(rangeSql).toContain('user_id = ? and child_profile_id is ? and deleted_at is null');
  expect(rangeParams).toEqual(['user-1', 'child-1', expect.any(String), expect.any(String)]);
  expect(previousSql).toContain('administered_at < ?');
  expect(previousSql).toContain('order by administered_at desc limit 1');
  expect(previousParams).toEqual(['user-1', 'child-1', rangeParams[2]]);

  for (const query of [foodQuery, weightQuery]) {
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(query.eq).toHaveBeenCalledWith('child_profile_id', 'child-1');
    expect(query.is).toHaveBeenCalledWith('deleted_at', null);
  }
});

it('ordnet neue Gewichte per Messzeit und Legacy-Gewichte per Messdatum ein', async () => {
  weightQuery = remoteQuery([
    {
      measured_on: '2026-08-30',
      measured_at: '2026-08-30T05:15:00+02:00',
      weight_kg: 90.8,
    },
    { measured_on: '2026-08-28', measured_at: null, weight_kg: 91.1 },
  ]);
  mockFrom.mockImplementation((table: string) =>
    table === 'food_entries' ? foodQuery : weightQuery,
  );
  const queryClient = createQueryClient();
  const { result } = await renderHook(
    () => useCorrelationSeries('user-1', null, '2026-08-30', '06:00'),
    {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    },
  );

  await waitFor(() => expect(result.current.data).toHaveLength(90));
  expect(result.current.data?.find(({ date }) => date === '2026-08-29')?.weightKg).toBe(90.8);
  expect(result.current.data?.find(({ date }) => date === '2026-08-30')?.weightKg).toBeNull();
  expect(result.current.data?.find(({ date }) => date === '2026-08-28')?.weightKg).toBe(91.1);
  expect(weightQuery.select).toHaveBeenCalledWith('measured_on, measured_at, weight_kg');
  const rangeFilter = weightQuery.or.mock.calls[0]?.[0] as string | undefined;
  expect(rangeFilter).toContain('and(measured_at.gte.');
  expect(rangeFilter).toContain(',measured_at.lt.');
  expect(rangeFilter).toContain(
    'and(measured_at.is.null,measured_on.gte.2026-06-02,measured_on.lte.2026-08-30)',
  );
});

it('liefert Supabase-Fehler als Query-Fehler an den Aufrufer', async () => {
  foodQuery = remoteQuery([], { message: 'food range unavailable' });
  mockFrom.mockImplementation((table: string) =>
    table === 'food_entries' ? foodQuery : weightQuery,
  );
  const queryClient = createQueryClient();
  const { result } = await renderHook(
    () => useCorrelationSeries('user-1', null, '2026-08-30', '06:00'),
    {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    },
  );

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toEqual(new Error('food range unavailable'));
});
