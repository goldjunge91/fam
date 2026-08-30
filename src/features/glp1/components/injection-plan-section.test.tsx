import { render, screen, userEvent } from '@testing-library/react-native';
import { InjectionPlanSection } from './injection-plan-section';

const mockCreatePlan = jest.fn();
const mockUpdatePlan = jest.fn();
const mockDeletePlan = jest.fn();
const mockUseRecentMedicationLogs = jest.fn();

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

jest.mock('@/features/glp1/hooks/glp1-api', () => ({
  useRecentMedicationLogs: (...args: unknown[]) => mockUseRecentMedicationLogs(...args),
}));

jest.mock('@/features/glp1/hooks/injection-plan-api', () => ({
  useInjectionPlan: () => ({ data: mockPlan, isLoading: false, isError: false }),
  useCreateInjectionPlanMutation: () => ({ mutate: mockCreatePlan, isPending: false }),
  useUpdateInjectionPlanMutation: () => ({ mutate: mockUpdatePlan, isPending: false }),
  useDeleteInjectionPlanMutation: () => ({ mutate: mockDeletePlan, isPending: false }),
}));

jest.mock('@/features/glp1/hooks/use-injection-reminder', () => ({
  useInjectionReminder: jest.fn(),
}));

function plan(anchorAt: string) {
  return {
    id: 'plan-1',
    user_id: 'user-1',
    medication_name: 'Semaglutid',
    dose: 0.5,
    unit: 'mg',
    cadence_days: 7,
    anchor_at: anchorAt,
    reminder_enabled: true,
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: '2026-08-01T08:00:00.000Z',
  };
}

beforeEach(() => {
  mockPlan = null;
  mockCreatePlan.mockClear();
  mockUpdatePlan.mockClear();
  mockDeletePlan.mockClear();
  mockUseRecentMedicationLogs.mockReset();
  mockUseRecentMedicationLogs.mockReturnValue({ data: [], isLoading: false });
});

describe('InjectionPlanSection', () => {
  it.each([
    ['Anstehend', '2026-09-02T08:00:00.000Z'],
    ['Heute fällig', '2026-08-30T08:00:00.000Z'],
    ['Überfällig', '2026-08-29T08:00:00.000Z'],
  ])('zeigt den Fälligkeitszustand %s', async (statusLabel, anchorAt) => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-30T12:00:00.000Z'));
    mockPlan = plan(anchorAt);

    try {
      await render(<InjectionPlanSection userId="user-1" />);
      expect(screen.getByText(statusLabel)).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('berechnet die Fälligkeit aus der letzten Injektion des Planmedikaments', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-30T12:00:00.000Z'));
    mockPlan = plan('2026-08-01T08:00:00.000Z');
    mockUseRecentMedicationLogs.mockReturnValue({
      data: [
        {
          medication_name: 'Tirzepatid',
          administered_at: '2026-08-29T08:00:00.000Z',
        },
        {
          medication_name: 'Semaglutid',
          administered_at: '2026-08-24T08:00:00.000Z',
        },
      ],
      isLoading: false,
    });

    try {
      await render(<InjectionPlanSection userId="user-1" />);

      expect(mockUseRecentMedicationLogs).toHaveBeenCalledWith('user-1');
      expect(screen.getByText(/31\.08\.2026/)).toBeOnTheScreen();
      expect(screen.queryByText(/05\.09\.2026/)).not.toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('legt einen Injektionsplan an', async () => {
    const user = userEvent.setup();
    await render(<InjectionPlanSection userId="user-1" />);

    await user.press(screen.getByRole('button', { name: 'Injektionsplan anlegen' }));
    await user.press(screen.getByText('Plan speichern'));

    expect(mockCreatePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        medicationName: 'Semaglutid',
        dose: 0.5,
        unit: 'mg',
        cadenceDays: 7,
        reminderEnabled: true,
      }),
      expect.any(Object),
    );
  });

  it('aendert und entfernt einen bestehenden Injektionsplan', async () => {
    const user = userEvent.setup();
    mockPlan = plan('2026-08-30T08:00:00.000Z');
    await render(<InjectionPlanSection userId="user-1" />);

    await user.press(screen.getByRole('button', { name: 'Injektionsplan bearbeiten' }));
    await user.press(screen.getByText('Änderungen speichern'));
    expect(mockUpdatePlan).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'plan-1', userId: 'user-1' }),
      expect.any(Object),
    );

    await user.press(screen.getByRole('button', { name: 'Injektionsplan entfernen' }));
    expect(mockDeletePlan).toHaveBeenCalledWith(
      { id: 'plan-1', userId: 'user-1' },
      expect.any(Object),
    );
  });
});
