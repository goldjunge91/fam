import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WeightTrackingScreen } from '@/features/calorie-tracking/weight-tracking-screen';

const mockUseWeightHistory = jest.fn();
const mockAddWeightEntry = jest.fn().mockResolvedValue({ id: 'weight-3' });

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
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({ data: { tracking_day_start_time: '00:00' }, isLoading: false }),
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
});
