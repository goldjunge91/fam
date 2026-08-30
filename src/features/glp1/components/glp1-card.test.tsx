import { render, screen, userEvent } from '@testing-library/react-native';
import { Glp1Card } from './glp1-card';

const mockMutateMed = jest.fn();
const mockMutateSymptom = jest.fn();
const mockUpdateMed = jest.fn();
const mockUpdateSymptom = jest.fn();
const mockDeleteMed = jest.fn();
const mockDeleteSymptom = jest.fn();
const mockRestoreMed = jest.fn();
const mockRestoreSymptom = jest.fn();
const mockShowUndoSnackbar = jest.fn();
const mockCreatePlan = jest.fn();
const mockUpdatePlan = jest.fn();
const mockDeletePlan = jest.fn();
const mockUseMedicationLogs = jest.fn();
const mockUseSymptomLogs = jest.fn();

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

let mockMedLogs: {
  id: string;
  medication_name: string;
  dose: number;
  unit: string;
  administered_at: string;
  injection_site?: string | null;
  notes?: string | null;
}[] = [];

let mockSymptomLogs: {
  id: string;
  appetite_level: number;
  satiety_level: number;
  nausea_level: number;
  logged_at: string;
  side_effects?: string[];
  notes?: string | null;
}[] = [];

jest.mock('@/features/glp1/hooks/glp1-api', () => ({
  useMedicationLogs: (...args: unknown[]) => mockUseMedicationLogs(...args),
  useSymptomLogs: (...args: unknown[]) => mockUseSymptomLogs(...args),
  useAddMedicationLogMutation: () => ({ mutate: mockMutateMed, isPending: false }),
  useAddSymptomLogMutation: () => ({ mutate: mockMutateSymptom, isPending: false }),
  useUpdateMedicationLogMutation: () => ({ mutate: mockUpdateMed, isPending: false }),
  useUpdateSymptomLogMutation: () => ({ mutate: mockUpdateSymptom, isPending: false }),
  useDeleteMedicationLogMutation: () => ({ mutate: mockDeleteMed, isPending: false }),
  useDeleteSymptomLogMutation: () => ({ mutate: mockDeleteSymptom, isPending: false }),
  useRestoreMedicationLogMutation: () => ({ mutate: mockRestoreMed, isPending: false }),
  useRestoreSymptomLogMutation: () => ({ mutate: mockRestoreSymptom, isPending: false }),
}));

jest.mock('@/components/ui/snackbar', () => ({
  useSnackbar: () => ({ showUndoSnackbar: mockShowUndoSnackbar }),
}));

jest.mock('@/features/glp1/hooks/injection-plan-api', () => ({
  useInjectionPlan: () => ({ data: mockPlan, isLoading: false }),
  useCreateInjectionPlanMutation: () => ({ mutate: mockCreatePlan, isPending: false }),
  useUpdateInjectionPlanMutation: () => ({ mutate: mockUpdatePlan, isPending: false }),
  useDeleteInjectionPlanMutation: () => ({ mutate: mockDeletePlan, isPending: false }),
}));

jest.mock('@/features/glp1/hooks/use-injection-reminder', () => ({
  useInjectionReminder: jest.fn(),
}));

beforeEach(() => {
  mockMedLogs = [];
  mockSymptomLogs = [];
  mockPlan = null;
  mockMutateMed.mockClear();
  mockMutateSymptom.mockClear();
  mockUpdateMed.mockClear();
  mockUpdateSymptom.mockClear();
  mockDeleteMed.mockClear();
  mockDeleteSymptom.mockClear();
  mockRestoreMed.mockClear();
  mockRestoreSymptom.mockClear();
  mockShowUndoSnackbar.mockClear();
  mockCreatePlan.mockClear();
  mockUpdatePlan.mockClear();
  mockDeletePlan.mockClear();
  mockUseMedicationLogs.mockClear();
  mockUseSymptomLogs.mockClear();
  mockUseMedicationLogs.mockImplementation(() => ({ data: mockMedLogs, isLoading: false }));
  mockUseSymptomLogs.mockImplementation(() => ({ data: mockSymptomLogs, isLoading: false }));
});

describe('Glp1Card', () => {
  it('zeigt leeren Zustand wenn keine Injektionen oder Symptome geloggt sind', async () => {
    await render(<Glp1Card userId="user-1" />);
    expect(screen.getByText(/GLP-1 & Medikation/)).toBeOnTheScreen();
    expect(screen.getByText('Keine Injektion erfasst')).toBeOnTheScreen();
    expect(screen.getByText('Kein Symptom-Log')).toBeOnTheScreen();
  });

  it('liest Medikation und Symptome im ausgewaehlten logischen Tagesfenster', async () => {
    await render(
      <Glp1Card
        userId="user-1"
        childProfileId="child-1"
        logicalDate="2026-08-18"
        dayStartTime="06:00"
      />,
    );

    expect(mockUseMedicationLogs).toHaveBeenCalledWith(
      'user-1',
      'child-1',
      '2026-08-18',
      '06:00',
    );
    expect(mockUseSymptomLogs).toHaveBeenCalledWith(
      'user-1',
      'child-1',
      '2026-08-18',
      '06:00',
    );
  });

  it('zeigt letzte Injektion und Symptom-Status an', async () => {
    mockMedLogs = [
      {
        id: 'm1',
        medication_name: 'Ozempic',
        dose: 0.5,
        unit: 'mg',
        administered_at: new Date().toISOString(),
      },
    ];
    mockSymptomLogs = [
      {
        id: 's1',
        appetite_level: 2,
        satiety_level: 5,
        nausea_level: 0,
        logged_at: new Date().toISOString(),
        side_effects: [],
      },
    ];

    await render(<Glp1Card userId="user-1" />);
    expect(screen.getByText('Ozempic (0.5 mg)')).toBeOnTheScreen();
    expect(screen.getByText('heute')).toBeOnTheScreen();
    expect(screen.getByText('Appetit 2/5 · Sättigung 5/5')).toBeOnTheScreen();
    expect(screen.getByText('Keine Nebenwirkungen')).toBeOnTheScreen();
  });

  it('oeffnet Injektions-Formular und sendet Mutation', async () => {
    const user = userEvent.setup();
    await render(<Glp1Card userId="user-1" />);
    const openBtn = screen.getByText('+ Injektion eintragen');
    await user.press(openBtn);

    expect(screen.getByText('Injektion erfassen')).toBeOnTheScreen();
    const saveBtn = screen.getByText('Injektion speichern');
    await user.press(saveBtn);

    expect(mockMutateMed).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        medicationName: 'Semaglutid',
        dose: 0.5,
        unit: 'mg',
      }),
      expect.any(Object),
    );
  });

  it('zeigt bei reinem Symptom-Log einen gefuellten Verlauf', async () => {
    const user = userEvent.setup();
    mockSymptomLogs = [
      {
        id: 's1',
        appetite_level: 3,
        satiety_level: 4,
        nausea_level: 2,
        logged_at: '2026-08-30T05:30:00.000Z',
        side_effects: ['Kopfschmerz', 'Müdigkeit'],
        notes: 'Nach dem Frühstück',
      },
    ];

    await render(<Glp1Card userId="user-1" />);
    await user.press(screen.getByText('Bisherigen Verlauf anzeigen'));

    expect(screen.getByText('Symptome · Appetit 3/5 · Sättigung 4/5')).toBeOnTheScreen();
    expect(screen.getAllByText('Kopfschmerz · Müdigkeit')).toHaveLength(2);
    expect(screen.getByText('Nach dem Frühstück')).toBeOnTheScreen();
  });

  it('erfasst Injektionsstelle, Einheit, Zeitpunkt und Notiz', async () => {
    const user = userEvent.setup();
    await render(<Glp1Card userId="user-1" />);
    await user.press(screen.getByText('+ Injektion eintragen'));

    await user.press(screen.getByRole('radio', { name: 'ml' }));
    await user.press(screen.getByRole('radio', { name: 'Oberschenkel' }));
    await user.clear(screen.getByLabelText('Zeitpunkt der Injektion'));
    await user.type(screen.getByLabelText('Zeitpunkt der Injektion'), '2026-08-30 06:15');
    await user.type(screen.getByLabelText('Notiz zur Injektion'), 'Rechter Oberschenkel');
    await user.press(screen.getByText('Injektion speichern'));

    expect(mockMutateMed).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        unit: 'ml',
        injectionSite: 'thigh',
        administeredAt: expect.any(String),
        notes: 'Rechter Oberschenkel',
      }),
      expect.any(Object),
    );
  });

  it('blockiert ungueltige Formwerte ueber das Zod-Schema', async () => {
    const user = userEvent.setup();
    await render(<Glp1Card userId="user-1" />);
    await user.press(screen.getByText('+ Injektion eintragen'));

    await user.clear(screen.getByLabelText('Zeitpunkt der Injektion'));
    await user.type(screen.getByLabelText('Zeitpunkt der Injektion'), 'kein Datum');
    await user.press(screen.getByText('Injektion speichern'));

    expect(await screen.findByText('Bitte als JJJJ-MM-TT HH:MM eingeben')).toBeOnTheScreen();
    expect(mockMutateMed).not.toHaveBeenCalled();
  });

  it('erfasst konkrete Nebenwirkungen, Zeitpunkt und Notiz', async () => {
    const user = userEvent.setup();
    await render(<Glp1Card userId="user-1" />);
    await user.press(screen.getByText('+ Symptome loggen'));

    await user.type(screen.getByLabelText('Konkrete Nebenwirkungen'), 'Kopfschmerz, Müdigkeit');
    await user.clear(screen.getByLabelText('Zeitpunkt der Symptome'));
    await user.type(screen.getByLabelText('Zeitpunkt der Symptome'), '2026-08-30 07:30');
    await user.type(screen.getByLabelText('Notiz zu den Symptomen'), 'Nach dem Frühstück');
    await user.press(screen.getByText('Status speichern'));

    expect(mockMutateSymptom).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        sideEffects: ['Kopfschmerz', 'Müdigkeit'],
        loggedAt: expect.any(String),
        notes: 'Nach dem Frühstück',
      }),
      expect.any(Object),
    );
  });

  it('bearbeitet einen bestehenden Eintrag mit demselben Formular', async () => {
    const user = userEvent.setup();
    mockMedLogs = [
      {
        id: 'm1',
        medication_name: 'Semaglutid',
        dose: 0.5,
        unit: 'mg',
        administered_at: '2026-08-30T08:00:00.000Z',
        injection_site: 'abdomen',
        notes: 'Links',
      },
    ];

    await render(<Glp1Card userId="user-1" />);
    await user.press(screen.getByText('Bisherigen Verlauf anzeigen'));
    await user.press(screen.getByRole('button', { name: 'Injektion bearbeiten' }));
    expect(screen.getByText('Injektion bearbeiten')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Links')).toBeOnTheScreen();
    expect(screen.getByText('Zuletzt: Bauch')).toBeOnTheScreen();

    await user.press(screen.getByText('Änderungen speichern'));
    expect(mockUpdateMed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm1', userId: 'user-1', notes: 'Links' }),
      expect.any(Object),
    );
  });

  it('loescht weich und stellt den Eintrag ueber Undo wieder her', async () => {
    const user = userEvent.setup();
    mockMedLogs = [
      {
        id: 'm1',
        medication_name: 'Semaglutid',
        dose: 0.5,
        unit: 'mg',
        administered_at: '2026-08-30T08:00:00.000Z',
      },
    ];
    mockDeleteMed.mockImplementation((_input: unknown, options?: { onSuccess?: () => void }) =>
      options?.onSuccess?.(),
    );

    await render(<Glp1Card userId="user-1" />);
    await user.press(screen.getByText('Bisherigen Verlauf anzeigen'));
    await user.press(screen.getByRole('button', { name: 'Injektion löschen' }));

    expect(mockDeleteMed).toHaveBeenCalledWith(
      { id: 'm1', userId: 'user-1', childProfileId: undefined },
      expect.any(Object),
    );
    expect(mockShowUndoSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Injektion gelöscht', onUndo: expect.any(Function) }),
    );

    const { onUndo } = mockShowUndoSnackbar.mock.calls[0][0];
    onUndo();
    expect(mockRestoreMed).toHaveBeenCalledWith({
      id: 'm1',
      userId: 'user-1',
      childProfileId: undefined,
    });
  });

  it('loescht und restauriert auch einen Symptom-Eintrag', async () => {
    const user = userEvent.setup();
    mockSymptomLogs = [
      {
        id: 's1',
        appetite_level: 2,
        satiety_level: 4,
        nausea_level: 1,
        logged_at: '2026-08-30T08:00:00.000Z',
        side_effects: ['Müdigkeit'],
      },
    ];
    mockDeleteSymptom.mockImplementation((_input: unknown, options?: { onSuccess?: () => void }) =>
      options?.onSuccess?.(),
    );

    await render(<Glp1Card userId="user-1" />);
    await user.press(screen.getByText('Bisherigen Verlauf anzeigen'));
    await user.press(screen.getByRole('button', { name: 'Symptome löschen' }));

    expect(mockShowUndoSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Symptom-Log gelöscht', onUndo: expect.any(Function) }),
    );
    const { onUndo } = mockShowUndoSnackbar.mock.calls[0][0];
    onUndo();
    expect(mockRestoreSymptom).toHaveBeenCalledWith({
      id: 's1',
      userId: 'user-1',
      childProfileId: undefined,
    });
  });

  it.each([
    ['Anstehend', '2026-09-02T08:00:00.000Z'],
    ['Heute fällig', '2026-08-30T08:00:00.000Z'],
    ['Überfällig', '2026-08-29T08:00:00.000Z'],
  ])('zeigt den Fälligkeitszustand %s', async (statusLabel, anchorAt) => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-30T12:00:00.000Z'));
    mockPlan = {
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

    await render(<Glp1Card userId="user-1" />);
    expect(screen.getByText(statusLabel)).toBeOnTheScreen();
    jest.useRealTimers();
  });

  it('legt einen Injektionsplan an', async () => {
    const user = userEvent.setup();
    await render(<Glp1Card userId="user-1" />);
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
    mockPlan = {
      id: 'plan-1',
      user_id: 'user-1',
      medication_name: 'Semaglutid',
      dose: 0.5,
      unit: 'mg',
      cadence_days: 7,
      anchor_at: '2026-08-30T08:00:00.000Z',
      reminder_enabled: true,
      created_at: '2026-08-01T08:00:00.000Z',
      updated_at: '2026-08-01T08:00:00.000Z',
    };

    await render(<Glp1Card userId="user-1" />);
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

  it('blendet den accountweiten Plan bei ausgewaehltem Kind aus', async () => {
    mockPlan = {
      id: 'plan-1',
      user_id: 'user-1',
      medication_name: 'Semaglutid',
      dose: 0.5,
      unit: 'mg',
      cadence_days: 7,
      anchor_at: '2026-08-30T08:00:00.000Z',
      reminder_enabled: true,
      created_at: '2026-08-01T08:00:00.000Z',
      updated_at: '2026-08-01T08:00:00.000Z',
    };

    await render(<Glp1Card userId="user-1" childProfileId="child-1" />);
    expect(screen.queryByText('Nächste Injektion')).not.toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Injektionsplan bearbeiten' }),
    ).not.toBeOnTheScreen();
  });
});
