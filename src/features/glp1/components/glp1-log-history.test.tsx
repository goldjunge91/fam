import { render, screen, userEvent } from '@testing-library/react-native';
import type { MedicationLogRow, SymptomLogRow } from '@/features/glp1/hooks/glp1-api';
import { Glp1LogHistory } from './glp1-log-history';

const medicationLog = {
  id: 'medication-1',
  user_id: 'user-1',
  child_profile_id: null,
  medication_name: 'Semaglutid',
  dose: 0.5,
  unit: 'mg',
  injection_site: 'thigh',
  administered_at: '2026-08-30T08:00:00.000Z',
  notes: 'Rechter Oberschenkel',
  created_at: '2026-08-30T08:00:00.000Z',
  updated_at: '2026-08-30T08:00:00.000Z',
  deleted_at: null,
} satisfies MedicationLogRow;

const symptomLog = {
  id: 'symptom-1',
  user_id: 'user-1',
  child_profile_id: null,
  logged_at: '2026-08-30T07:30:00.000Z',
  appetite_level: 3,
  satiety_level: 4,
  nausea_level: 2,
  side_effects: ['Kopfschmerz', 'Müdigkeit'],
  notes: 'Nach dem Frühstück',
  created_at: '2026-08-30T07:30:00.000Z',
  updated_at: '2026-08-30T07:30:00.000Z',
  deleted_at: null,
} satisfies SymptomLogRow;

describe('Glp1LogHistory', () => {
  it('zeigt Zeitstempel, Einheiten, Injektionsstelle, Nebenwirkungen und Notizen', async () => {
    const user = userEvent.setup();
    await render(
      <Glp1LogHistory
        items={[
          { kind: 'injection', timestamp: medicationLog.administered_at, log: medicationLog },
          { kind: 'symptom', timestamp: symptomLog.logged_at, log: symptomLog },
        ]}
        onEditMedication={jest.fn()}
        onDeleteMedication={jest.fn()}
        onEditSymptom={jest.fn()}
        onDeleteSymptom={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Bisherigen Verlauf anzeigen' }));

    expect(screen.getByText('Injektion · Semaglutid 0.5 mg')).toBeOnTheScreen();
    expect(screen.getAllByText(/30\.08\.2026/)).toHaveLength(2);
    expect(screen.getByText('Rechter Oberschenkel')).toBeOnTheScreen();
    expect(screen.getByText('Symptome · Appetit 3/5 · Sättigung 4/5')).toBeOnTheScreen();
    expect(screen.getByText('Kopfschmerz · Müdigkeit')).toBeOnTheScreen();
    expect(screen.getByText('Nach dem Frühstück')).toBeOnTheScreen();
  });

  it('stellt Bearbeiten und Löschen pro Log bereit', async () => {
    const user = userEvent.setup();
    const onEditMedication = jest.fn();
    const onDeleteSymptom = jest.fn();
    await render(
      <Glp1LogHistory
        items={[
          { kind: 'injection', timestamp: medicationLog.administered_at, log: medicationLog },
          { kind: 'symptom', timestamp: symptomLog.logged_at, log: symptomLog },
        ]}
        onEditMedication={onEditMedication}
        onDeleteMedication={jest.fn()}
        onEditSymptom={jest.fn()}
        onDeleteSymptom={onDeleteSymptom}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Bisherigen Verlauf anzeigen' }));
    await user.press(screen.getByRole('button', { name: 'Injektion bearbeiten' }));
    await user.press(screen.getByRole('button', { name: 'Symptome löschen' }));

    expect(onEditMedication).toHaveBeenCalledWith(medicationLog);
    expect(onDeleteSymptom).toHaveBeenCalledWith(symptomLog);
  });
});
