import { fireEvent, render, screen } from '@testing-library/react-native';
import { InjectionReminderSettingsCard } from './injection-reminder-settings-card';

const mockUseInjectionPlan = jest.fn();
const mockUpdateInjectionPlan = jest.fn();
let mockMutationPending = false;
let mockMutationError = false;
let mockNextTime = '09:15';

const PLAN = {
  id: 'plan-1',
  user_id: 'user-1',
  medication_name: 'Wegovy',
  dose: 1,
  unit: 'mg',
  cadence_days: 7,
  anchor_at: '2026-10-29T07:30:00.000Z',
  reminder_enabled: false,
  created_at: '2026-10-01T08:00:00.000Z',
  updated_at: '2026-10-01T08:00:00.000Z',
};

jest.mock('@expo/ui', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    Host: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Switch: ({
      value,
      onValueChange,
      disabled,
      label,
    }: {
      value: boolean;
      onValueChange: (value: boolean) => void;
      disabled: boolean;
      label: string;
    }) => (
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        onPress={() => onValueChange(!value)}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/components/forms/time-wheel-field', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    TimeWheelField: ({
      label,
      value,
      onChange,
    }: {
      label: string;
      value: string;
      onChange: (time: string) => void;
    }) => (
      <View>
        <Text>{`${label}: ${value}`}</Text>
        <Pressable testID="time-wheel-invalid" onPress={() => onChange('not-a-time')} />
        <Pressable testID="time-wheel-valid" onPress={() => onChange(mockNextTime)} />
      </View>
    ),
  };
});

jest.mock('@/features/glp1/hooks/injection-plan-api', () => ({
  useInjectionPlan: (...args: unknown[]) => mockUseInjectionPlan(...args),
  useUpdateInjectionPlanMutation: () => ({
    mutate: mockUpdateInjectionPlan,
    isPending: mockMutationPending,
    isError: mockMutationError,
  }),
}));

jest.mock('@/features/glp1/hooks/use-injection-reminder', () => ({
  useInjectionReminder: (...args: unknown[]) => mockUseInjectionReminder(...args),
}));

const mockUseInjectionReminder = jest.fn();

beforeEach(() => {
  mockUseInjectionPlan.mockReset();
  mockUpdateInjectionPlan.mockReset();
  mockUseInjectionReminder.mockReset();
  mockMutationPending = false;
  mockMutationError = false;
  mockNextTime = '09:15';
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

  it('zeigt den Ladezustand und registriert die Erinnerung nur für die angegebene Person', async () => {
    mockUseInjectionPlan.mockReturnValue({ data: null, isLoading: true, isError: false });

    await render(<InjectionReminderSettingsCard userId="user-1" />);

    expect(screen.getByText('Injektions-Erinnerung wird geladen...')).toBeOnTheScreen();
    expect(mockUseInjectionReminder).toHaveBeenCalledWith('user-1');
    expect(mockUseInjectionPlan).toHaveBeenCalledWith('user-1');
  });

  it('speichert das Aktivieren mit unveränderten Planangaben', async () => {
    mockUseInjectionPlan.mockReturnValue({ data: PLAN, isLoading: false, isError: false });

    await render(<InjectionReminderSettingsCard userId="user-1" />);
    await fireEvent.press(screen.getByRole('switch', { name: 'An fällige Injektion erinnern' }));

    expect(mockUpdateInjectionPlan).toHaveBeenCalledWith({
      id: 'plan-1',
      userId: 'user-1',
      medicationName: 'Wegovy',
      dose: 1,
      unit: 'mg',
      cadenceDays: 7,
      anchorAt: PLAN.anchor_at,
      reminderEnabled: true,
    });
  });

  it('validiert die Zeitänderung und speichert eine gültige Uhrzeit am Plandatum', async () => {
    mockUseInjectionPlan.mockReturnValue({ data: PLAN, isLoading: false, isError: false });

    await render(<InjectionReminderSettingsCard userId="user-1" />);
    await fireEvent.press(screen.getByTestId('time-wheel-invalid'));

    expect(screen.getByText('Bitte eine gültige Uhrzeit auswählen.')).toBeOnTheScreen();
    expect(mockUpdateInjectionPlan).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('time-wheel-valid'));

    expect(screen.queryByText('Bitte eine gültige Uhrzeit auswählen.')).toBeNull();
    expect(mockUpdateInjectionPlan).toHaveBeenCalledWith({
      id: 'plan-1',
      userId: 'user-1',
      medicationName: 'Wegovy',
      dose: 1,
      unit: 'mg',
      cadenceDays: 7,
      anchorAt: expect.any(String),
      reminderEnabled: false,
    });
    const savedAnchorAt = new Date(mockUpdateInjectionPlan.mock.calls[0][0].anchorAt);
    const originalAnchorAt = new Date(PLAN.anchor_at);
    expect(savedAnchorAt.getFullYear()).toBe(originalAnchorAt.getFullYear());
    expect(savedAnchorAt.getMonth()).toBe(originalAnchorAt.getMonth());
    expect(savedAnchorAt.getDate()).toBe(originalAnchorAt.getDate());
    expect(savedAnchorAt.getHours()).toBe(9);
    expect(savedAnchorAt.getMinutes()).toBe(15);
  });

  it('deaktiviert den Schalter während des Speicherns und zeigt Mutation-Fehler', async () => {
    mockUseInjectionPlan.mockReturnValue({ data: PLAN, isLoading: false, isError: false });
    mockMutationPending = true;
    mockMutationError = true;

    await render(<InjectionReminderSettingsCard userId="user-1" />);

    expect(screen.getByRole('switch', { name: 'An fällige Injektion erinnern' })).toBeDisabled();
    expect(screen.getByText('Die Uhrzeit konnte nicht gespeichert werden.')).toBeOnTheScreen();
  });

  it('lässt Änderungen ohne angemeldete Person aus', async () => {
    mockUseInjectionPlan.mockReturnValue({ data: PLAN, isLoading: false, isError: false });

    await render(<InjectionReminderSettingsCard userId={undefined} />);
    await fireEvent.press(screen.getByRole('switch', { name: 'An fällige Injektion erinnern' }));
    await fireEvent.press(screen.getByTestId('time-wheel-valid'));

    expect(mockUpdateInjectionPlan).not.toHaveBeenCalled();
  });
});
