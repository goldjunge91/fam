import {
  notifyManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';
import React from 'react';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import {
  type CreateMedicationLogInput,
  fetchLatestMedicationLog,
  fetchMedicationLogsForLogicalDay,
  fetchRecentSymptomLogs,
  fetchSymptomLogsForLogicalDay,
  latestMedicationLogQueryKey,
  medicationLogsQueryKey,
  recentMedicationLogsQueryKey,
  symptomLogsQueryKey,
  useAddMedicationLogMutation,
  useAddSymptomLogMutation,
  useDeleteMedicationLogMutation,
  useDeleteSymptomLogMutation,
  useMedicationLogs,
  useRecentMedicationLogs,
  useRestoreMedicationLogMutation,
  useRestoreSymptomLogMutation,
  useSymptomLogs,
  useUpdateMedicationLogMutation,
  useUpdateSymptomLogMutation,
} from './glp1-api';

const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockDatabase = {
  getAllAsync: mockGetAllAsync,
  getFirstAsync: mockGetFirstAsync,
};

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: jest.fn(),
}));

jest.mock('@/lib/sync/mirror-write', () => ({
  applyLocalMirrorWrite: jest.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  notifyManager.setScheduler((notify) => notify());
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllAsync.mockResolvedValue([]);
  jest
    .mocked(getDatabase)
    .mockResolvedValue(mockDatabase as unknown as Awaited<ReturnType<typeof getDatabase>>);
  jest.mocked(Crypto.randomUUID).mockReturnValue('local-medication-id');
  mockGetFirstAsync.mockResolvedValue(null);
  jest.mocked(enqueueMutation).mockImplementation(async (_db, input) => {
    await input.applyLocally(mockDatabase as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });
});

afterEach(() => {
  onlineManager.setOnline(true);
});

afterAll(() => {
  notifyManager.setScheduler((notify) => setTimeout(notify, 0));
});

it('liest Medikationsdaten aus dem lokalen Spiegel, wenn das Gerät offline ist', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const medication = {
    id: 'medication-1',
    user_id: 'user-1',
    child_profile_id: null,
    medication_name: 'Mounjaro',
    dose: 5,
    unit: 'mg',
    injection_site: 'thigh',
    administered_at: '2026-08-18T08:00:00.000Z',
    notes: null,
    created_at: '2026-08-18T08:00:00.000Z',
    updated_at: Date.parse('2026-08-18T08:00:00.000Z'),
    deleted_at: null,
  };
  mockGetAllAsync.mockResolvedValue([medication]);
  onlineManager.setOnline(false);

  const { result } = await renderHook(
    () => useMedicationLogs('user-1', null, '2026-08-18', '06:00'),
    {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    },
  );

  await waitFor(() =>
    expect(result.current.data).toEqual([
      { ...medication, updated_at: '2026-08-18T08:00:00.000Z' },
    ]),
  );
});

it('trennt die all-time letzten Injektionen vom ausgewählten logischen Tag', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  mockGetAllAsync.mockResolvedValue([
    {
      id: 'older-medication',
      user_id: 'user-1',
      child_profile_id: null,
      medication_name: 'Mounjaro',
      dose: 5,
      unit: 'units',
      injection_site: 'upper_arm',
      administered_at: '2026-07-01T08:00:00.000Z',
      notes: null,
      created_at: '2026-07-01T08:00:00.000Z',
      updated_at: Date.parse('2026-07-01T08:00:00.000Z'),
      deleted_at: null,
    },
  ]);
  onlineManager.setOnline(false);

  const { result } = await renderHook(() => useRecentMedicationLogs('user-1', null, 3), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  });

  await waitFor(() => expect(result.current.data?.[0]?.id).toBe('older-medication'));
  const [sql, params] = mockGetAllAsync.mock.calls[0];
  expect(sql).not.toContain('administered_at >=');
  expect(params).toEqual(['user-1', null, 3]);
});

it('liest Symptome offline und fällt bei ungültigen Legacy-Nebenwirkungen sicher zurück', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const baseSymptom = {
    user_id: 'user-1',
    child_profile_id: 'child-1',
    logged_at: '2026-08-18T09:00:00.000Z',
    appetite_level: 2,
    satiety_level: 4,
    nausea_level: 1,
    notes: null,
    created_at: '2026-08-18T09:00:00.000Z',
    updated_at: Date.parse('2026-08-18T09:00:00.000Z'),
    deleted_at: null,
  };
  mockGetAllAsync.mockResolvedValue([
    { ...baseSymptom, id: 'symptom-1', side_effects: '["Kopfschmerz"]' },
    { ...baseSymptom, id: 'symptom-legacy', side_effects: '{kaputt' },
  ]);
  onlineManager.setOnline(false);

  const { result } = await renderHook(
    () => useSymptomLogs('user-1', 'child-1', '2026-08-18', '06:00'),
    {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    },
  );

  await waitFor(() =>
    expect(result.current.data?.map((row) => row.side_effects)).toEqual([['Kopfschmerz'], []]),
  );
  const [sql, params] = mockGetAllAsync.mock.calls[0];
  expect(sql).toContain('user_id = ? and child_profile_id is ? and deleted_at is null');
  expect(params).toEqual(['user-1', 'child-1', expect.any(String), expect.any(String)]);
});

it('liest die zuletzt erfassten Symptome offline ohne logisches Tagesfenster', async () => {
  mockGetAllAsync.mockResolvedValue([
    {
      id: 'symptom-recent',
      user_id: 'user-1',
      child_profile_id: null,
      logged_at: '2026-08-17T08:00:00.000Z',
      appetite_level: 2,
      satiety_level: 5,
      nausea_level: 1,
      side_effects: '["Kopfschmerz"]',
      notes: null,
      created_at: '2026-08-17T08:00:00.000Z',
      updated_at: Date.parse('2026-08-17T08:00:00.000Z'),
      deleted_at: null,
    },
  ]);
  onlineManager.setOnline(false);

  await expect(
    fetchRecentSymptomLogs({ userId: 'user-1', childProfileId: null, limit: 3 }),
  ).resolves.toEqual([
    expect.objectContaining({ id: 'symptom-recent', side_effects: ['Kopfschmerz'] }),
  ]);

  const [sql, params] = mockGetAllAsync.mock.calls[0];
  expect(sql).toContain('from symptom_logs');
  expect(sql).toContain('order by logged_at desc');
  expect(sql).not.toContain('logged_at >=');
  expect(params).toEqual(['user-1', null, 3]);
});

it('legt eine Injektion lokal mit stabiler Unit atomar in Spiegel und Outbox an', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const { result } = await renderHook(() => useAddMedicationLogMutation(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  });
  onlineManager.setOnline(false);

  const created = await act(() =>
    result.current.mutateAsync({
      userId: 'user-1',
      childProfileId: null,
      medicationName: ' Mounjaro ',
      dose: 5,
      unit: 'units',
      injectionSite: 'thigh',
      administeredAt: '2026-08-18T08:00:00.000Z',
      notes: ' morgens ',
    }),
  );

  expect(created).toEqual(expect.objectContaining({ id: 'local-medication-id', unit: 'units' }));
  expect(enqueueMutation).toHaveBeenCalledWith(
    mockDatabase,
    expect.objectContaining({
      entity: 'medication_logs',
      entityId: 'local-medication-id',
      op: 'insert',
      payload: expect.objectContaining({
        user_id: 'user-1',
        child_profile_id: null,
        medication_name: 'Mounjaro',
        unit: 'units',
      }),
    }),
  );
  expect(applyLocalMirrorWrite).toHaveBeenCalledWith(
    mockDatabase,
    'medication_logs',
    'insert',
    expect.objectContaining({ id: 'local-medication-id', unit: 'units' }),
    expect.any(Number),
  );
});

it('verwirft ungueltige Injektionsdaten vor SQLite und Outbox', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const { result } = await renderHook(() => useAddMedicationLogMutation(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  });

  const invalidInput = {
    userId: 'user-1',
    medicationName: 'Semaglutid',
    dose: -1,
    unit: 'drops',
    injectionSite: 'hand',
  } as unknown as CreateMedicationLogInput;

  await expect(act(() => result.current.mutateAsync(invalidInput))).rejects.toThrow();

  expect(getDatabase).not.toHaveBeenCalled();
  expect(enqueueMutation).not.toHaveBeenCalled();
});

it('aktualisiert nur eine Injektion aus demselben Account- und Child-Scope', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  mockGetFirstAsync.mockResolvedValue({
    id: 'medication-1',
    user_id: 'user-1',
    child_profile_id: 'child-1',
    medication_name: 'Mounjaro',
    dose: 5,
    unit: 'mcg',
    injection_site: 'thigh',
    administered_at: '2026-08-18T08:00:00.000Z',
    notes: null,
    created_at: '2026-08-18T08:00:00.000Z',
    updated_at: Date.parse('2026-08-18T08:00:00.000Z'),
    deleted_at: null,
  });
  const { result } = await renderHook(() => useUpdateMedicationLogMutation(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  });

  const updated = await act(() =>
    result.current.mutateAsync({
      id: 'medication-1',
      userId: 'user-1',
      childProfileId: 'child-1',
      medicationName: 'Mounjaro',
      dose: 7.5,
      unit: 'mcg',
      injectionSite: 'upper_arm',
      administeredAt: '2026-08-19T08:00:00.000Z',
      notes: null,
    }),
  );

  expect(updated).toEqual(expect.objectContaining({ dose: 7.5, unit: 'mcg' }));
  expect(mockGetFirstAsync).toHaveBeenCalledWith(
    expect.stringContaining('id = ? and user_id = ? and child_profile_id is ?'),
    ['medication-1', 'user-1', 'child-1'],
  );
  expect(enqueueMutation).toHaveBeenCalledWith(
    mockDatabase,
    expect.objectContaining({
      entity: 'medication_logs',
      entityId: 'medication-1',
      op: 'update',
      payload: expect.objectContaining({ id: 'medication-1', dose: 7.5, unit: 'mcg' }),
    }),
  );
});

it('behaelt beim Injektions-Update einen ausgelassenen Zeitpunkt bei', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  mockGetFirstAsync.mockResolvedValue({
    id: 'medication-1',
    user_id: 'user-1',
    child_profile_id: null,
    medication_name: 'Semaglutid',
    dose: 0.5,
    unit: 'mg',
    injection_site: 'abdomen',
    administered_at: '2026-08-18T08:00:00.000Z',
    notes: null,
    created_at: '2026-08-18T08:00:00.000Z',
    updated_at: Date.parse('2026-08-18T08:00:00.000Z'),
    deleted_at: null,
  });
  const { result } = await renderHook(() => useUpdateMedicationLogMutation(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  });

  await act(() =>
    result.current.mutateAsync({
      id: 'medication-1',
      userId: 'user-1',
      medicationName: 'Semaglutid',
      dose: 1,
      unit: 'mg',
    }),
  );

  expect(enqueueMutation).toHaveBeenCalledWith(
    mockDatabase,
    expect.objectContaining({
      payload: expect.objectContaining({ administered_at: '2026-08-18T08:00:00.000Z' }),
    }),
  );
});

it.each([
  ['delete', useDeleteMedicationLogMutation],
  ['restore', useRestoreMedicationLogMutation],
] as const)('%s einer Injektion bleibt atomar und strikt im Profil-Scope', async (op, useHook) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  mockGetFirstAsync.mockResolvedValue({ id: 'medication-1' });
  const { result } = await renderHook(() => useHook(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  });

  await act(() =>
    result.current.mutateAsync({
      id: 'medication-1',
      userId: 'user-1',
      childProfileId: 'child-1',
    }),
  );

  expect(mockGetFirstAsync).toHaveBeenCalledWith(
    expect.stringContaining('id = ? and user_id = ? and child_profile_id is ?'),
    ['medication-1', 'user-1', 'child-1'],
  );
  expect(enqueueMutation).toHaveBeenCalledWith(
    mockDatabase,
    expect.objectContaining({ entity: 'medication_logs', entityId: 'medication-1', op }),
  );
  expect(applyLocalMirrorWrite).toHaveBeenCalledWith(
    mockDatabase,
    'medication_logs',
    op,
    { id: 'medication-1' },
    expect.any(Number),
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['glp1', 'medications', 'user-1', 'child-1'],
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['glp1', 'correlation', 'user-1', 'child-1'],
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sync-status'] });
});

it('legt Symptome offline mit JSON-Text im lokalen Spiegel an', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  jest.mocked(Crypto.randomUUID).mockReturnValue('local-symptom-id');
  onlineManager.setOnline(false);
  const { result } = await renderHook(() => useAddSymptomLogMutation(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  });

  const created = await act(() =>
    result.current.mutateAsync({
      userId: 'user-1',
      childProfileId: null,
      loggedAt: '2026-08-18T09:00:00.000Z',
      appetiteLevel: 2,
      satietyLevel: 4,
      nauseaLevel: 1,
      sideEffects: ['Kopfschmerz', 'Müdigkeit'],
      notes: ' leicht ',
    }),
  );
  expect(created.side_effects).toEqual(['Kopfschmerz', 'Müdigkeit']);
  expect(enqueueMutation).toHaveBeenCalledWith(
    mockDatabase,
    expect.objectContaining({
      entity: 'symptom_logs',
      entityId: 'local-symptom-id',
      op: 'insert',
      payload: expect.objectContaining({ side_effects: ['Kopfschmerz', 'Müdigkeit'] }),
    }),
  );
  expect(applyLocalMirrorWrite).toHaveBeenCalledWith(
    mockDatabase,
    'symptom_logs',
    'insert',
    expect.objectContaining({ side_effects: '["Kopfschmerz","Müdigkeit"]' }),
    expect.any(Number),
  );
});

it('verwirft ungueltige Symptomdaten vor SQLite und Outbox', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const { result } = await renderHook(() => useAddSymptomLogMutation(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  });

  await expect(
    act(() =>
      result.current.mutateAsync({
        userId: 'user-1',
        appetiteLevel: 9,
        satietyLevel: 4,
        nauseaLevel: 0,
      }),
    ),
  ).rejects.toThrow();

  expect(getDatabase).not.toHaveBeenCalled();
  expect(enqueueMutation).not.toHaveBeenCalled();
});

it('aktualisiert Symptome im Account-/Child-Scope und serialisiert Nebenwirkungen lokal', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  mockGetFirstAsync.mockResolvedValue({
    id: 'symptom-1',
    user_id: 'user-1',
    child_profile_id: null,
    logged_at: '2026-08-18T09:00:00.000Z',
    appetite_level: 2,
    satiety_level: 4,
    nausea_level: 1,
    side_effects: '[]',
    notes: null,
    created_at: '2026-08-18T09:00:00.000Z',
    updated_at: Date.parse('2026-08-18T09:00:00.000Z'),
    deleted_at: null,
  });
  const { result } = await renderHook(() => useUpdateSymptomLogMutation(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  });

  const updated = await act(() =>
    result.current.mutateAsync({
      id: 'symptom-1',
      userId: 'user-1',
      childProfileId: null,
      loggedAt: '2026-08-19T09:00:00.000Z',
      appetiteLevel: 3,
      satietyLevel: 5,
      nauseaLevel: 0,
      sideEffects: ['Müdigkeit'],
      notes: null,
    }),
  );

  expect(updated.side_effects).toEqual(['Müdigkeit']);
  expect(mockGetFirstAsync).toHaveBeenCalledWith(
    expect.stringContaining('id = ? and user_id = ? and child_profile_id is ?'),
    ['symptom-1', 'user-1', null],
  );
  expect(enqueueMutation).toHaveBeenCalledWith(
    mockDatabase,
    expect.objectContaining({
      entity: 'symptom_logs',
      op: 'update',
      payload: expect.objectContaining({ side_effects: ['Müdigkeit'] }),
    }),
  );
  expect(applyLocalMirrorWrite).toHaveBeenCalledWith(
    mockDatabase,
    'symptom_logs',
    'update',
    expect.objectContaining({ side_effects: '["Müdigkeit"]' }),
    expect.any(Number),
  );
});

it.each([
  ['delete', useDeleteSymptomLogMutation],
  ['restore', useRestoreSymptomLogMutation],
] as const)('%s eines Symptoms bleibt atomar und strikt im Profil-Scope', async (op, useHook) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  mockGetFirstAsync.mockResolvedValue({ id: 'symptom-1' });
  const { result } = await renderHook(() => useHook(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  });

  await act(() =>
    result.current.mutateAsync({
      id: 'symptom-1',
      userId: 'user-1',
      childProfileId: null,
    }),
  );

  expect(mockGetFirstAsync).toHaveBeenCalledWith(
    expect.stringContaining('id = ? and user_id = ? and child_profile_id is ?'),
    ['symptom-1', 'user-1', null],
  );
  expect(enqueueMutation).toHaveBeenCalledWith(
    mockDatabase,
    expect.objectContaining({ entity: 'symptom_logs', entityId: 'symptom-1', op }),
  );
  expect(applyLocalMirrorWrite).toHaveBeenCalledWith(
    mockDatabase,
    'symptom_logs',
    op,
    { id: 'symptom-1' },
    expect.any(Number),
  );
});

it('verwirft Mutationen, wenn die ID nicht zum Account- und Child-Scope gehört', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  mockGetFirstAsync.mockResolvedValue(null);
  const { result } = await renderHook(() => useDeleteMedicationLogMutation(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  });

  await expect(
    act(() =>
      result.current.mutateAsync({
        id: 'foreign-medication',
        userId: 'user-1',
        childProfileId: 'child-1',
      }),
    ),
  ).rejects.toThrow('Injektion wurde in diesem Profil nicht gefunden.');
  expect(enqueueMutation).not.toHaveBeenCalled();
});

it('liest die letzte Medikation all-time und filtert optional nach dem Plan-Medikament', async () => {
  mockGetAllAsync.mockResolvedValue([
    {
      id: 'latest-medication',
      user_id: 'user-1',
      child_profile_id: null,
      medication_name: 'Mounjaro',
      dose: 5,
      unit: 'mg',
      injection_site: 'thigh',
      administered_at: '2026-08-20T10:00:00.000Z',
      notes: null,
      created_at: '2026-08-20T10:00:00.000Z',
      updated_at: Date.parse('2026-08-20T10:00:00.000Z'),
      deleted_at: null,
    },
  ]);
  await expect(
    fetchLatestMedicationLog({
      userId: 'user-1',
      childProfileId: null,
      medicationName: 'Semaglutid',
    }),
  ).resolves.toEqual(expect.objectContaining({ id: 'latest-medication' }));

  const [sql, params] = mockGetAllAsync.mock.calls[0];
  expect(sql).toContain('order by administered_at desc');
  expect(sql).toContain('medication_name = ? collate nocase');
  expect(sql).not.toContain('administered_at >=');
  expect(params).toEqual(['user-1', null, 'Semaglutid', 1]);
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
    null,
  ]);
  expect(recentMedicationLogsQueryKey('user-1', null, 3)).toEqual([
    'glp1',
    'medications',
    'user-1',
    null,
    'recent',
    3,
  ]);
});

it.each([
  ['medication', fetchMedicationLogsForLogicalDay, 'medication_logs', 'administered_at'],
  ['symptom', fetchSymptomLogsForLogicalDay, 'symptom_logs', 'logged_at'],
] as const)(
  'verdrahtet das halb-offene logische Tagesfenster fuer %s logs',
  async (_kind, fetchLogs, table, timestampColumn) => {
    mockGetAllAsync.mockResolvedValue([]);
    await fetchLogs({
      userId: 'user-1',
      childProfileId: null,
      logicalDate: '2026-08-18',
      dayStartTime: '06:00',
    });

    const [sql, params] = mockGetAllAsync.mock.calls[0];
    expect(sql).toContain(`from ${table}`);
    expect(sql).toContain(`${timestampColumn} >= ? and ${timestampColumn} < ?`);
    expect(sql).toContain('deleted_at is null');
    expect(params.slice(0, 2)).toEqual(['user-1', null]);

    const start = new Date(params[2]);
    const nextStart = new Date(params[3]);
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
