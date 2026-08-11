import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DiaryScreen } from '@/features/calorie-tracking/diary-screen';

// ProgressRing animiert per Reanimated — der Worklets-Native-Bootstrap laeuft
// unter Jest nicht, und selbst `react-native-reanimated/mock` startet ihn in
// dieser Version erneut. Fuer diesen Test zaehlt nur die Datenverdrahtung,
// nicht die Animation, daher eine einfache Ersatzkomponente.
jest.mock('@/components/progress-ring', () => {
  const { Text } = require('react-native');
  return {
    ProgressRing: ({ value, target, label }: { value: number; target: number; label: string }) => (
      <Text>{`${label}: ${Math.round(value)}/${target}`}</Text>
    ),
  };
});

const mockUseFoodEntries = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/calorie-tracking/api', () => ({
  useCurrentGoal: () => ({
    data: { daily_kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 67 },
  }),
  useFoodEntries: (...args: unknown[]) => mockUseFoodEntries(...args),
}));

let mockChildProfiles: { id: string; display_name: string }[] = [];
const mockSetProfile = jest.fn();

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: { id: 'hh-1', name: 'Zuhause' } }),
}));

jest.mock('@/features/household/api', () => ({
  useChildProfiles: () => ({ data: mockChildProfiles, isLoading: false }),
}));

jest.mock('@/features/calorie-tracking/active-profile-store', () => ({
  useActiveProfile: () => ({
    profile: { type: 'adult', userId: 'user-1' },
    setProfile: mockSetProfile,
  }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    text: '#000000',
    textSecondary: '#60646C',
    border: '#DDDDE3',
    accent: '#208AEF',
    success: '#1A7F4B',
    warning: '#B26A00',
    danger: '#C62828',
  }),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <DiaryScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockChildProfiles = [];
  mockSetProfile.mockClear();
  mockUseFoodEntries.mockReset();
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
  (router.push as jest.Mock).mockClear();
});

describe('DiaryScreen', () => {
  it('gruppiert Eintraege nach Mahlzeit', async () => {
    await renderScreen();
    expect(screen.getByText('Haferflocken')).toBeTruthy();
    expect(screen.getByText('Reis mit Huhn')).toBeTruthy();
    expect(screen.getByText('Frühstück')).toBeTruthy();
    expect(screen.getByText('Mittagessen')).toBeTruthy();
  });

  it('zeigt die Tagessumme aus allen Eintraegen', async () => {
    await renderScreen();
    expect(screen.getByText('Kalorien: 640/2000')).toBeTruthy(); // 190 + 450
  });

  it('oeffnet die Lebensmittelsuche vorbelegt mit der Mahlzeit', async () => {
    await renderScreen();
    const addButtons = screen.getAllByText('+ Hinzufügen');
    await fireEvent.press(addButtons[0]);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/food-search',
        params: expect.objectContaining({ mealType: 'breakfast' }),
      }),
    );
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

  it('zeigt "Gestern" nach einem Schritt zurueck (#88)', async () => {
    await renderScreen();
    expect(screen.getByText('Heute')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Vorheriger Tag'));
    expect(screen.getByText('Gestern')).toBeTruthy();
  });
});

describe('DiaryScreen — Profil-Auswahl (#85)', () => {
  beforeEach(() => {
    mockChildProfiles = [{ id: 'child-1', display_name: 'Mia' }];
  });

  it('zeigt keine Profil-Auswahl ohne Kinderprofile', async () => {
    mockChildProfiles = [];
    await renderScreen();
    expect(screen.queryByText('Ich')).not.toBeOnTheScreen();
  });

  it('zeigt "Ich" und alle Kinderprofile, wenn Kinderprofile vorhanden sind', async () => {
    await renderScreen();
    expect(screen.getByText('Ich')).toBeTruthy();
    expect(screen.getByText('Mia')).toBeTruthy();
  });

  it('filtert useFoodEntries nach dem gewaehlten Kind-Profil', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Mia'));

    expect(mockSetProfile).toHaveBeenCalledWith({
      type: 'child',
      childProfileId: 'child-1',
      householdId: 'hh-1',
    });
  });
});
