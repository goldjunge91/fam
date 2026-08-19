import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ProfileHubScreen } from './profile-hub-screen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

const mockProfile = {
  id: 'user-1',
  display_name: 'Max Mustermann',
  birth_date: '1990-01-01',
  height_cm: 180,
  sex: 'male',
  activity_level: 'moderate',
  tracking_day_start_time: '00:00',
};

const mockGoal = {
  daily_kcal: 2200,
  protein_g: 160,
  carbs_g: 220,
  fat_g: 70,
};

const mockWeight = {
  weight_kg: 80,
};

const mockMutateStartTime = jest.fn();
const mockMutateMethod = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1', email: 'max@example.com' } } }),
}));

jest.mock('@/features/auth/api', () => ({
  useProfile: () => ({ data: mockProfile, isLoading: false }),
}));

jest.mock('@/features/calorie-tracking/api', () => ({
  useCurrentGoal: () => ({ data: mockGoal, isLoading: false }),
  useLatestWeightEntry: () => ({ data: mockWeight, isLoading: false }),
  useUpdateTrackingDayStartTimeMutation: () => ({ mutate: mockMutateStartTime, isPending: false }),
  useUpdateTrackingMethodMutation: () => ({ mutate: mockMutateMethod, isPending: false }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
}));

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileHubScreen />
    </QueryClientProvider>,
  );
}

describe('ProfileHubScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert Profil-Kopfkarte mit Namen, E-Mail und Initialen', async () => {
    await renderScreen();

    expect(screen.getByText('Max Mustermann')).toBeOnTheScreen();
    expect(screen.getByText('max@example.com')).toBeOnTheScreen();
    expect(screen.getByText('MM')).toBeOnTheScreen();
    expect(screen.getByText('Stammdaten bearbeiten ›')).toBeOnTheScreen();
  });

  it('navigiert zur Stammdaten-Bearbeitung beim Klick auf Stammdaten bearbeiten', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const editBtn = screen.getByText('Stammdaten bearbeiten ›');
    await user.press(editBtn);

    expect(router.push).toHaveBeenCalledWith('/settings/edit-profile');
  });

  it('zeigt berechneten Grundumsatz (BMR) und Gesamtbedarf (TDEE) an', async () => {
    await renderScreen();

    expect(screen.getByText('Grundumsatz (BMR)')).toBeOnTheScreen();
    expect(screen.getByText('Gesamtbedarf (TDEE)')).toBeOnTheScreen();
    expect(screen.getByText('Größe: 180 cm')).toBeOnTheScreen();
    expect(screen.getByText('Gewicht: 80 kg')).toBeOnTheScreen();
  });

  it('zeigt Kalorien-Tagesziel und Makro-Verteilung an', async () => {
    await renderScreen();

    expect(screen.getByText('Kalorien-Tagesziel')).toBeOnTheScreen();
    expect(screen.getByText('2200 kcal')).toBeOnTheScreen();
    expect(screen.getByText('P: 160g · C: 220g · F: 70g')).toBeOnTheScreen();
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

  it('wechselt die aktive Tracking-Methode im Profil', async () => {
    const user = userEvent.setup();
    await renderScreen();

    expect(screen.getByText('DEINE TRACKING-METHODE')).toBeOnTheScreen();
    const glp1Btn = screen.getByText('GLP-1 & Medikation');
    await user.press(glp1Btn);

    expect(mockMutateMethod).toHaveBeenCalledWith({
      userId: 'user-1',
      method: 'glp1',
    });
  });
});
