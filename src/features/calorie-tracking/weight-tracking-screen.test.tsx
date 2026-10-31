import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WeightTrackingScreen } from '@/features/calorie-tracking/weight-tracking-screen';

const mockUseWeightHistory = jest.fn();
const mockAddWeightEntry = jest.fn().mockResolvedValue({ id: 'weight-3' });
let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } };
let mockProfile: { tracking_day_start_time: string } | null = { tracking_day_start_time: '00:00' };

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  },
  useNavigation: () => ({
    canGoBack: () => true,
    addListener: () => () => {},
  }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({ data: mockProfile, isLoading: false }),
}));

jest.mock('@/features/calorie-tracking/api', () => ({
  useWeightHistory: (...args: unknown[]) => mockUseWeightHistory(...args),
  useAddWeightEntryMutation: () => ({
    mutateAsync: mockAddWeightEntry,
    isPending: false,
  }),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <WeightTrackingScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockUseWeightHistory.mockReset();
  mockAddWeightEntry.mockClear();
  mockSession = { user: { id: 'user-1' } };
  mockProfile = { tracking_day_start_time: '00:00' };
  mockUseWeightHistory.mockReturnValue({
    data: [
      {
        id: 'weight-2',
        measured_on: '2026-08-19',
        measured_at: '2026-08-19T08:30:00.000Z',
        weight_kg: 80.5,
      },
      {
        id: 'weight-1',
        measured_on: '2026-08-18',
        measured_at: '2026-08-18T08:30:00.000Z',
        weight_kg: 81,
      },
    ],
    isLoading: false,
  });
});

describe('WeightTrackingScreen', () => {
  it('zeigt Diagramm und Historie der persönlichen Messungen', async () => {
    await renderScreen();

    expect(screen.getByRole('button', { name: 'Zurück zu Tagebuch' })).toBeOnTheScreen();
    expect(screen.getByText('Verlauf')).toBeOnTheScreen();
    expect(screen.getByText('Historie')).toBeOnTheScreen();
    expect(screen.getAllByText('80,5 kg').length).toBeGreaterThan(0);
    expect(screen.getByText('Dienstag, 18. August 2026')).toBeOnTheScreen();
  });

  it('speichert einen neuen Eintrag aus dem Gewichtsscreen', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 19, 12, 0));

    try {
      await renderScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Neuer Eintrag' }));
      await fireEvent.changeText(screen.getByLabelText('Gewicht (kg)'), '79,8');
      await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

      expect(mockAddWeightEntry).toHaveBeenCalledWith({
        userId: 'user-1',
        weightKg: 79.8,
        measuredOn: '2026-08-19',
        dayStartTime: '00:00',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('zeigt den leeren Verlauf ohne Profil', async () => {
    mockProfile = null;
    mockUseWeightHistory.mockReturnValue({ data: [], isLoading: false });

    await renderScreen();

    expect(screen.getByText('Noch kein Eintrag')).toBeOnTheScreen();
    expect(screen.getByText('Füge deine erste Messung hinzu.')).toBeOnTheScreen();
    expect(screen.getByText('Noch keine Messungen vorhanden.')).toBeOnTheScreen();
  });

  it('zeigt den Ladezustand des Verlaufs', async () => {
    mockUseWeightHistory.mockReturnValue({ data: [], isLoading: true });

    await renderScreen();

    expect(screen.getByText('Lade Gewichtseinträge...')).toBeOnTheScreen();
    expect(screen.queryByText('Die letzten 2 Messungen')).toBeNull();
  });

  it('validiert unbrauchbare Gewichte und erlaubt das Verwerfen des Formulars', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Neuer Eintrag' }));
    await fireEvent.changeText(screen.getByLabelText('Gewicht (kg)'), '700');
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    expect(screen.getByText('Bitte gib ein gültiges Gewicht unter 700 kg ein.')).toBeOnTheScreen();
    expect(mockAddWeightEntry).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByLabelText('Gewicht (kg)')).toBeNull();
  });

  it('zeigt einen Speicherfehler an und löscht ihn beim Ändern des Gewichts', async () => {
    mockAddWeightEntry.mockRejectedValueOnce(new Error('offline'));
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Neuer Eintrag' }));
    await fireEvent.changeText(screen.getByLabelText('Gewicht (kg)'), '79');
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    expect(
      await screen.findByText('Der Gewichtseintrag konnte nicht gespeichert werden.'),
    ).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Gewicht (kg)'), '79,1');
    expect(screen.queryByText('Der Gewichtseintrag konnte nicht gespeichert werden.')).toBeNull();
  });
});
