import { getSupabase } from '@/lib/supabase';
import {
  fetchLatestMedicationLog,
  fetchMedicationLogsForLogicalDay,
  fetchSymptomLogsForLogicalDay,
  latestMedicationLogQueryKey,
  medicationLogsQueryKey,
  symptomLogsQueryKey,
} from './glp1-api';

const mockEq = jest.fn();
const mockIs = jest.fn();
const mockOrder = jest.fn();
const mockGte = jest.fn();
const mockLt = jest.fn();
const mockLimit = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

const queryBuilder = {
  eq: mockEq,
  is: mockIs,
  order: mockOrder,
  gte: mockGte,
  lt: mockLt,
  limit: mockLimit,
  select: mockSelect,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockReturnValue(queryBuilder);
  mockIs.mockReturnValue(queryBuilder);
  mockOrder.mockReturnValue(queryBuilder);
  mockGte.mockReturnValue(queryBuilder);
  mockLt.mockResolvedValue({ data: [], error: null });
  mockLimit.mockResolvedValue({
    data: [{ id: 'latest-medication', administered_at: '2026-08-20T10:00:00.000Z' }],
    error: null,
  });
  mockSelect.mockReturnValue(queryBuilder);
  mockFrom.mockReturnValue(queryBuilder);
  jest
    .mocked(getSupabase)
    .mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabase>);
});

it('liest die letzte Medikation all-time ohne logisches Tagesfenster', async () => {
  await expect(
    fetchLatestMedicationLog({ userId: 'user-1', childProfileId: null }),
  ).resolves.toEqual(expect.objectContaining({ id: 'latest-medication' }));

  expect(mockOrder).toHaveBeenCalledWith('administered_at', { ascending: false });
  expect(mockLimit).toHaveBeenCalledWith(1);
  expect(mockGte).not.toHaveBeenCalled();
  expect(mockLt).not.toHaveBeenCalled();
});

it('trennt GLP-1 Tagesabfragen im Cache nach logischem Datum und Tagesstart', () => {
  expect(medicationLogsQueryKey('user-1', null, '2026-08-18', '06:00')).toEqual([
    'glp1',
    'medications',
    'user-1',
    null,
    'logical-day',
    '2026-08-18',
    '06:00',
  ]);
  expect(symptomLogsQueryKey('user-1', 'child-1', '2026-08-18', '06:00')).toEqual([
    'glp1',
    'symptoms',
    'user-1',
    'child-1',
    'logical-day',
    '2026-08-18',
    '06:00',
  ]);
  expect(latestMedicationLogQueryKey('user-1')).toEqual([
    'glp1',
    'medications',
    'user-1',
    null,
    'latest',
  ]);
});

it.each([
  ['medication', fetchMedicationLogsForLogicalDay, 'medication_logs', 'administered_at'],
  ['symptom', fetchSymptomLogsForLogicalDay, 'symptom_logs', 'logged_at'],
] as const)(
  'verdrahtet das halb-offene logische Tagesfenster fuer %s logs',
  async (_kind, fetchLogs, table, timestampColumn) => {
    await fetchLogs({
      userId: 'user-1',
      childProfileId: null,
      logicalDate: '2026-08-18',
      dayStartTime: '06:00',
    });

    expect(mockFrom).toHaveBeenCalledWith(table);
    expect(mockGte).toHaveBeenCalledWith(timestampColumn, expect.any(String));
    expect(mockLt).toHaveBeenCalledWith(timestampColumn, expect.any(String));

    const start = new Date(mockGte.mock.calls[0][1]);
    const nextStart = new Date(mockLt.mock.calls[0][1]);
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
  },
);
