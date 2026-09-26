import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DiaryScreen } from '@/features/calorie-tracking/diary-screen';

const mockUseFoodEntries = jest.fn();
const mockUseFoodEntriesForDateRange = jest.fn();
const mockGlp1Card = jest.fn((_props: unknown) => null);
let mockProfile: {
  tracking_day_start_time: string;
  tracking_method: string;
} | null = {
  tracking_day_start_time: '00:00',
  tracking_method: 'standard',
};

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({
    data: mockProfile,
    isLoading: false,
  }),
}));

jest.mock('@/features/glp1/components/glp1-card', () => ({
  Glp1Card: (props: unknown) => mockGlp1Card(props),
}));

jest.mock('@/features/settings/module-preferences', () => ({
  useModulePreferences: () => ({ data: { glp1: false, fasting: false }, isLoading: false }),
}));

jest.mock('@/features/glp1/hooks/glp1-api', () => ({
  useMedicationLogs: () => ({ data: [], isLoading: false }),
  useSymptomLogs: () => ({ data: [], isLoading: false }),
  useAddMedicationLogMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useAddSymptomLogMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('@/features/calorie-tracking/fasting-api', () => ({
  useActiveFastingSession: () => ({ data: null, isLoading: false }),
  useStartFastMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useEndFastMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/calorie-tracking/api', () => ({
  useCurrentGoal: () => ({
    data: { daily_kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 67 },
  }),
  useFoodEntries: (...args: unknown[]) => mockUseFoodEntries(...args),
  useFoodEntriesForDateRange: (...args: unknown[]) => mockUseFoodEntriesForDateRange(...args),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openDrawer: jest.fn(), openProfile: jest.fn() }),
}));

jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileInitials: () => 'MM',
  useProfileAvatar: () => ({ initials: 'MM', avatarUrl: null }),
}));

function ScreenUnderTest() {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <DiaryScreen />
    </SafeAreaProvider>
  );
}

function renderScreen() {
  return render(<ScreenUnderTest />);
}

beforeEach(() => {
  mockProfile = { tracking_day_start_time: '00:00', tracking_method: 'standard' };
  mockGlp1Card.mockClear();
  mockUseFoodEntries.mockReset();
  mockUseFoodEntriesForDateRange.mockReset();
  mockUseFoodEntries.mockReturnValue({
    data: [
      {
        id: 'e1',
        meal_type: 'breakfast',
        name: 'Haferflocken',
        quantity: 50,
        unit: 'g',
        kcal: 190,
        protein_g: 7,
        carbs_g: 32,
        fat_g: 3.5,
      },
      {
        id: 'e2',
        meal_type: 'lunch',
        name: 'Reis mit Huhn',
        quantity: 300,
        unit: 'g',
        kcal: 450,
        protein_g: 35,
        carbs_g: 55,
        fat_g: 8,
      },
    ],
    isLoading: false,
  });
  mockUseFoodEntriesForDateRange.mockReturnValue({ data: [], isLoading: false });
  (router.push as jest.Mock).mockClear();
});

describe('DiaryScreen', () => {
  it('reicht den ausgewaehlten logischen Tag und Tagesstart an GLP-1 weiter', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 19, 5, 15));
    mockProfile = { tracking_day_start_time: '06:00', tracking_method: 'glp1' };

    try {
      await renderScreen();

      expect(mockGlp1Card.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          logicalDate: '2026-08-18',
          dayStartTime: '06:00',
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('korrigiert Heute wenn der abweichende Tagesstart nachlaedt', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 19, 5, 15));
    mockProfile = null;

    try {
      const rendered = await renderScreen();
      mockProfile = { tracking_day_start_time: '06:00', tracking_method: 'glp1' };
      await rendered.rerender(<ScreenUnderTest />);

      expect(mockGlp1Card.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ logicalDate: '2026-08-18', dayStartTime: '06:00' }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('gruppiert Eintraege nach Mahlzeit', async () => {
    await renderScreen();
    expect(screen.getByText('Haferflocken')).toBeTruthy();
    expect(screen.getByText('Reis mit Huhn')).toBeTruthy();
    expect(screen.getByText('Frühstück')).toBeTruthy();
    expect(screen.getByText('Mittagessen')).toBeTruthy();
  });

  it('zeigt die Tagessumme aus allen Eintraegen', async () => {
    await renderScreen();
    // 190 + 450 = 640 gegessen, Ziel 2000 -> 1360 uebrig
    expect(screen.getByText('1.360')).toBeTruthy();
    expect(screen.getByText('kcal übrig · von 2.000')).toBeTruthy();
  });

  it('oeffnet die Lebensmittelsuche vorbelegt mit der Mahlzeit', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Zu Frühstück hinzufügen' }));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/add-food-entry',
        params: expect.objectContaining({ mealType: 'breakfast' }),
      }),
    );
  });

  it('öffnet den privaten Gewichtsverlauf über den Header-Icon-Button', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Gewichtsverlauf öffnen' }));

    expect(router.push).toHaveBeenCalledWith('/weight');
  });

  it('oeffnet einen bestehenden Eintrag zum Bearbeiten', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Haferflocken'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/add-food-entry',
        params: expect.objectContaining({ mealType: 'breakfast', entryId: 'e1' }),
      }),
    );
  });

  it('zeigt einen 14-Tage-Kalenderstreifen mit Heute am rechten Rand', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 19, 12, 0));
    mockUseFoodEntriesForDateRange.mockReturnValue({
      data: [
        {
          id: 'range-entry-1',
          logged_on: '2026-08-18',
          kcal: 2200,
          meal_type: 'lunch',
          name: 'Bowl',
          quantity: 1,
          unit: 'Portion',
          protein_g: 20,
          carbs_g: 30,
          fat_g: 10,
        },
      ],
      isLoading: false,
    });

    try {
      await renderScreen();
      expect(screen.getByText('Tippe auf einen Tag · wische für ältere Tage')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Heute, Mittwoch, 19. August/ })).toHaveStyle({
        minHeight: 44,
        width: 44,
      });
      expect(screen.getByRole('button', { name: /Gestern, Dienstag, 18. August/ })).toBeTruthy();

      await fireEvent.press(screen.getByRole('button', { name: /Gestern, Dienstag/ }));
    } finally {
      jest.useRealTimers();
    }

    expect(screen.getByText('Gestern')).toBeTruthy();
  });
});
