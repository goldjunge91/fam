import { render, screen, userEvent } from '@testing-library/react-native';
import { Glp1Card } from './glp1-card';

const mockMutateMed = jest.fn();
const mockMutateSymptom = jest.fn();

let mockMedLogs: {
  id: string;
  medication_name: string;
  dose: number;
  unit: string;
  administered_at: string;
}[] = [];

let mockSymptomLogs: {
  id: string;
  appetite_level: number;
  satiety_level: number;
  nausea_level: number;
  logged_at: string;
}[] = [];

jest.mock('@/features/calorie-tracking/glp1-api', () => ({
  useMedicationLogs: () => ({ data: mockMedLogs, isLoading: false }),
  useSymptomLogs: () => ({ data: mockSymptomLogs, isLoading: false }),
  useAddMedicationLogMutation: () => ({ mutate: mockMutateMed, isPending: false }),
  useAddSymptomLogMutation: () => ({ mutate: mockMutateSymptom, isPending: false }),
}));

beforeEach(() => {
  mockMedLogs = [];
  mockSymptomLogs = [];
  mockMutateMed.mockClear();
  mockMutateSymptom.mockClear();
});

describe('Glp1Card', () => {
  it('zeigt leeren Zustand wenn keine Injektionen oder Symptome geloggt sind', async () => {
    await render(<Glp1Card userId="user-1" />);
    expect(screen.getByText(/GLP-1 & Medikation/)).toBeOnTheScreen();
    expect(screen.getByText('Keine Injektion erfasst')).toBeOnTheScreen();
    expect(screen.getByText('Kein Symptom-Log')).toBeOnTheScreen();
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
});
