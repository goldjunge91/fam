import { renderHook, waitFor } from '@testing-library/react-native';
import { cancelLocalReminder, scheduleLocalReminder } from '@/lib/notifications';
import { injectionReminderIdentifier, useInjectionReminder } from './use-injection-reminder';

const mockUseLatestMedicationLog = jest.fn();
let mockPlan: {
  id: string;
  user_id: string;
  medication_name: string;
  dose: number;
  unit: string;
  cadence_days: number;
  anchor_at: string;
  reminder_enabled: boolean;
  created_at: string;
  updated_at: string;
} | null = null;
let mockMedicationLogs: { administered_at: string }[] = [];

jest.mock('@/features/glp1/hooks/injection-plan-api', () => ({
  useInjectionPlan: () => ({ data: mockPlan, isLoading: false }),
}));

jest.mock('@/features/glp1/hooks/glp1-api', () => ({
  useLatestMedicationLog: (...args: unknown[]) => mockUseLatestMedicationLog(...args),
}));

jest.mock('@/lib/notifications', () => ({
  cancelLocalReminder: jest.fn().mockResolvedValue(undefined),
  scheduleLocalReminder: jest.fn().mockResolvedValue(true),
}));

const mockCancelLocalReminder = jest.mocked(cancelLocalReminder);
const mockScheduleLocalReminder = jest.mocked(scheduleLocalReminder);

beforeEach(() => {
  jest.clearAllMocks();
  mockPlan = null;
  mockMedicationLogs = [];
  mockUseLatestMedicationLog.mockImplementation(() => ({
    data: mockMedicationLogs[0] ?? null,
    isLoading: false,
  }));
});

it('plant die accountweite Erinnerung aus Plan und erwachsener Historie', async () => {
  mockPlan = {
    id: 'plan-1',
    user_id: 'user-1',
    medication_name: 'Semaglutid',
    dose: 0.5,
    unit: 'mg',
    cadence_days: 7,
    anchor_at: '2099-09-01T08:00:00.000Z',
    reminder_enabled: true,
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: '2026-08-01T08:00:00.000Z',
  };

  await renderHook(() => useInjectionReminder('user-1'));

  await waitFor(() => {
    expect(mockScheduleLocalReminder).toHaveBeenCalledWith({
      identifier: injectionReminderIdentifier('user-1'),
      date: new Date('2099-09-01T08:00:00.000Z'),
      title: 'Injektion fällig',
      body: 'Deine Injektion ist fällig.',
    });
  });
  expect(mockUseLatestMedicationLog).toHaveBeenCalledWith('user-1', null, 'Semaglutid');
});

it('entfernt die Erinnerung wenn sie im Plan abgeschaltet ist', async () => {
  mockPlan = {
    id: 'plan-1',
    user_id: 'user-1',
    medication_name: 'Semaglutid',
    dose: 0.5,
    unit: 'mg',
    cadence_days: 7,
    anchor_at: '2099-09-01T08:00:00.000Z',
    reminder_enabled: false,
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: '2026-08-01T08:00:00.000Z',
  };

  await renderHook(() => useInjectionReminder('user-1'));

  await waitFor(() => {
    expect(mockCancelLocalReminder).toHaveBeenCalledWith(injectionReminderIdentifier('user-1'));
  });
  expect(mockScheduleLocalReminder).not.toHaveBeenCalled();
});

it('plant nach einer neuen Injektion auf deren Rhythmus neu', async () => {
  mockPlan = {
    id: 'plan-1',
    user_id: 'user-1',
    medication_name: 'Semaglutid',
    dose: 0.5,
    unit: 'mg',
    cadence_days: 7,
    anchor_at: '2099-09-01T08:00:00.000Z',
    reminder_enabled: true,
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: '2026-08-01T08:00:00.000Z',
  };
  const { rerender } = await renderHook(() => useInjectionReminder('user-1'));
  await waitFor(() => {
    expect(mockScheduleLocalReminder).toHaveBeenCalledTimes(1);
  });

  mockMedicationLogs = [{ administered_at: '2099-08-31T08:00:00.000Z' }];
  await rerender({});

  await waitFor(() => {
    expect(mockScheduleLocalReminder).toHaveBeenLastCalledWith(
      expect.objectContaining({ date: new Date('2099-09-07T08:00:00.000Z') }),
    );
  });
});

it('serialisiert eine laufende Planung vor einer nachfolgenden Deaktivierung', async () => {
  let finishScheduling: (() => void) | undefined;
  mockScheduleLocalReminder.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finishScheduling = () => resolve(true);
      }),
  );
  mockPlan = {
    id: 'plan-1',
    user_id: 'user-1',
    medication_name: 'Semaglutid',
    dose: 0.5,
    unit: 'mg',
    cadence_days: 7,
    anchor_at: '2099-09-01T08:00:00.000Z',
    reminder_enabled: true,
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: '2026-08-01T08:00:00.000Z',
  };

  const { rerender } = await renderHook(() => useInjectionReminder('user-1'));
  await waitFor(() => expect(mockScheduleLocalReminder).toHaveBeenCalledTimes(1));

  mockPlan = { ...mockPlan, reminder_enabled: false };
  await rerender({});
  expect(mockCancelLocalReminder).not.toHaveBeenCalled();

  finishScheduling?.();
  await waitFor(() =>
    expect(mockCancelLocalReminder).toHaveBeenLastCalledWith(injectionReminderIdentifier('user-1')),
  );
});

it('entfernt die accountgebundene Erinnerung beim Account-Wechsel', async () => {
  mockPlan = {
    id: 'plan-1',
    user_id: 'user-1',
    medication_name: 'Semaglutid',
    dose: 0.5,
    unit: 'mg',
    cadence_days: 7,
    anchor_at: '2099-09-01T08:00:00.000Z',
    reminder_enabled: true,
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: '2026-08-01T08:00:00.000Z',
  };
  const { rerender } = await renderHook(
    ({ activeUserId }: { activeUserId: string | undefined }) => useInjectionReminder(activeUserId),
    { initialProps: { activeUserId: 'user-1' as string | undefined } },
  );
  await waitFor(() => expect(mockScheduleLocalReminder).toHaveBeenCalledTimes(1));

  await rerender({ activeUserId: undefined });

  await waitFor(() =>
    expect(mockCancelLocalReminder).toHaveBeenLastCalledWith(injectionReminderIdentifier('user-1')),
  );
});
