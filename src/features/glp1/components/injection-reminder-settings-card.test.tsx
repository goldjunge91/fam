import { render, screen } from '@testing-library/react-native';
import { InjectionReminderSettingsCard } from './injection-reminder-settings-card';

const mockUseInjectionPlan = jest.fn();

jest.mock('@/features/glp1/hooks/injection-plan-api', () => ({
  useInjectionPlan: (...args: unknown[]) => mockUseInjectionPlan(...args),
  useUpdateInjectionPlanMutation: () => ({ mutate: jest.fn(), isPending: false, isError: false }),
}));

jest.mock('@/features/glp1/hooks/use-injection-reminder', () => ({
  useInjectionReminder: jest.fn(),
}));

beforeEach(() => {
  mockUseInjectionPlan.mockReset();
});

describe('InjectionReminderSettingsCard', () => {
  it('erklärt ohne Plan, wie Erinnerungen aktiviert werden', async () => {
    mockUseInjectionPlan.mockReturnValue({ data: null, isLoading: false, isError: false });

    await render(<InjectionReminderSettingsCard userId="user-1" />);

    expect(
      screen.getByText('Lege zuerst einen Injektionsplan an, um die Erinnerung zu aktivieren.'),
    ).toBeOnTheScreen();
  });

  it('zeigt einen Lesefehler getrennt vom leeren Zustand', async () => {
    mockUseInjectionPlan.mockReturnValue({ data: null, isLoading: false, isError: true });

    await render(<InjectionReminderSettingsCard userId="user-1" />);

    expect(
      screen.getByText('Injektions-Erinnerung konnte nicht geladen werden.'),
    ).toBeOnTheScreen();
  });
});
