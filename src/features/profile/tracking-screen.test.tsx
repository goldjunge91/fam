import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useSession } from '@/features/auth/session-provider';
import {
  useCurrentGoal,
  useLatestWeightEntry,
  useUpdateTrackingDayStartTimeMutation,
  useUpdateTrackingMethodMutation,
  useWeightEntries,
} from '@/features/calorie-tracking/api';
import { useProfile } from '@/features/profile/api';
import { TrackingScreen } from '@/features/profile/tracking-screen';

const mockInjectionPlanSection = jest.fn((_props: { userId: string | undefined }) => null);

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: jest.fn(),
  updateProfile: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/features/calorie-tracking/api', () => ({
  useCurrentGoal: jest.fn(),
  useLatestWeightEntry: jest.fn(),
  useWeightEntries: jest.fn(),
  useUpdateTrackingMethodMutation: jest.fn(),
  useUpdateTrackingDayStartTimeMutation: jest.fn(),
}));

jest.mock('@/features/glp1/components/injection-plan-section', () => ({
  InjectionPlanSection: (props: { userId: string | undefined }) => mockInjectionPlanSection(props),
}));

const mockMutateMethod = jest.fn();
const mockMutateStartTime = jest.fn();

async function renderScreen({
  trackingDayStartTime = '00:00',
  logicalDayWeightEntries = [{ weight_kg: 80 }],
}: {
  trackingDayStartTime?: string;
  logicalDayWeightEntries?: { weight_kg: number }[];
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });

  (useSession as jest.Mock).mockReturnValue({
    session: {
      user: { id: 'user-1', email: 'max@example.com' },
    },
  });

  (useProfile as jest.Mock).mockReturnValue({
    data: {
      id: 'user-1',
      display_name: 'Max Mustermann',
      height_cm: 180,
      sex: 'male',
      birth_date: '1990-01-01',
      activity_level: 'moderate',
      tracking_method: 'standard',
      tracking_day_start_time: trackingDayStartTime,
    },
    isLoading: false,
  });

  (useCurrentGoal as jest.Mock).mockReturnValue({
    data: {
      id: 'goal-1',
      daily_kcal: 2200,
      protein_g: 160,
      carbs_g: 220,
      fat_g: 70,
      goal_type: 'maintain',
      valid_from: '2026-01-01',
    },
    isLoading: false,
  });

  (useLatestWeightEntry as jest.Mock).mockReturnValue({
    data: { weight_kg: 80 },
    isLoading: false,
  });

  (useWeightEntries as jest.Mock).mockReturnValue({
    data: logicalDayWeightEntries,
    isLoading: false,
  });

  (useUpdateTrackingMethodMutation as jest.Mock).mockReturnValue({
    mutate: mockMutateMethod,
    isPending: false,
  });

  (useUpdateTrackingDayStartTimeMutation as jest.Mock).mockReturnValue({
    mutate: mockMutateStartTime,
    isPending: false,
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TrackingScreen />
    </QueryClientProvider>,
  );
}

describe('TrackingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert Tracking-Methode und Ernährung & Tagesziele', async () => {
    await renderScreen();

    expect(screen.getByText('DEINE TRACKING-METHODE')).toBeOnTheScreen();
    expect(screen.getByText('ERNÄHRUNG & TAGESZIELE')).toBeOnTheScreen();
    expect(screen.getByText('2200 kcal')).toBeOnTheScreen();
    expect(screen.getByText('160g')).toBeOnTheScreen();
  });

  it('zeigt den Injektionsplan direkt nach Aktivierung der GLP-1-Methode', async () => {
    const user = userEvent.setup();
    await renderScreen();
    expect(mockInjectionPlanSection).not.toHaveBeenCalled();

    await user.press(screen.getByRole('radio', { name: /GLP-1 & Medikation/ }));

    expect(mockInjectionPlanSection.mock.calls.at(-1)?.[0]).toEqual({ userId: 'user-1' });
  });

  it('navigiert zur Ziel-Bearbeitung beim Klick auf Ziele & Makros bearbeiten', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const editBtn = screen.getByText('Ziele & Makros bearbeiten');
    await user.press(editBtn);

    expect(router.push).toHaveBeenCalledWith('/settings/goals');
  });

  it('zeigt berechneten Grundumsatz (BMR) und Gesamtbedarf (TDEE) an', async () => {
    await renderScreen();

    expect(screen.getByText('Grundumsatz (BMR)')).toBeOnTheScreen();
    expect(screen.getByText('Gesamtbedarf (TDEE)')).toBeOnTheScreen();
    expect(screen.getByText('180 cm')).toBeOnTheScreen();
    expect(screen.getByText('80 kg')).toBeOnTheScreen();
  });

  it('zeigt vor 06:00 das Gewicht des vorherigen logischen Tages an', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 19, 5, 15));

    try {
      await renderScreen({
        trackingDayStartTime: '06:00',
        logicalDayWeightEntries: [{ weight_kg: 78.4 }],
      });

      expect(useWeightEntries).toHaveBeenCalledWith('user-1', null, '2026-08-18', '06:00');
      expect(screen.getByText('78.4 kg')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('aendert den individuellen Tagesstart per Stepper', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const nextBtn = screen.getByLabelText('Eine Stunde später');
    await user.press(nextBtn);

    expect(mockMutateStartTime).toHaveBeenCalledWith({
      userId: 'user-1',
      time: '01:00',
    });
  });

  it('erklaert die Wirkung auf alle Tracking-Bereiche ohne Bestandsdaten umzuschreiben', async () => {
    await renderScreen();

    expect(screen.getByText(/Mahlzeiten, Injektionen, Symptome und Gewicht/)).toBeOnTheScreen();
    expect(screen.getByText(/Bestehende Einträge bleiben unverändert/)).toBeOnTheScreen();
  });

  it('wechselt die aktive Tracking-Methode im Profil auf Low-Carb und Keto', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const lowCarbBtn = screen.getByText('Low-Carb');
    await user.press(lowCarbBtn);

    expect(mockMutateMethod).toHaveBeenCalledWith({
      userId: 'user-1',
      method: 'low_carb',
    });

    const ketoBtn = screen.getByText('Keto (Ketogen)');
    await user.press(ketoBtn);

    expect(mockMutateMethod).toHaveBeenCalledWith({
      userId: 'user-1',
      method: 'keto',
    });
  });
});
