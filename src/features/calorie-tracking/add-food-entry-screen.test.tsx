import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AddFoodEntryScreen } from '@/features/calorie-tracking/add-food-entry-screen';

// add-food-entry-screen importiert MEAL_LABELS aus diary-screen, das wiederum
// ProgressRing (Reanimated) laedt — dessen Worklets-Bootstrap laeuft unter
// Jest nicht. Fuer diesen Test zaehlt nur das Label-Mapping, nicht der Ring.
jest.mock('@/components/progress-ring', () => ({ ProgressRing: () => null }));

let mockParams: Record<string, string> = {};
let mockFoodEntries: unknown[] = [];

const mockAddMutateAsync = jest.fn().mockResolvedValue({});
const mockUpdateMutateAsync = jest.fn().mockResolvedValue({});
const mockDeleteMutateAsync = jest.fn().mockResolvedValue({});
const mockRestoreMutate = jest.fn();
const mockShowUndoSnackbar = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/calorie-tracking/api', () => ({
  useFoodEntries: () => ({ data: mockFoodEntries, isLoading: false }),
  useAddFoodEntryMutation: () => ({ mutateAsync: mockAddMutateAsync, isPending: false }),
  useUpdateFoodEntryMutation: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
  useDeleteFoodEntryMutation: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
  useRestoreFoodEntryMutation: () => ({ mutate: mockRestoreMutate, isPending: false }),
}));

jest.mock('@/components/snackbar', () => ({
  useSnackbar: () => ({ showUndoSnackbar: mockShowUndoSnackbar }),
}));

let mockChildProfiles: { id: string; display_name: string }[] = [];

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: { id: 'hh-1', name: 'Zuhause' } }),
}));

jest.mock('@/features/household/api', () => ({
  useChildProfiles: () => ({ data: mockChildProfiles, isLoading: false }),
}));

const mockSetProfile = jest.fn();

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
      <AddFoodEntryScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockParams = {};
  mockFoodEntries = [];
  mockChildProfiles = [];
  mockAddMutateAsync.mockClear();
  mockUpdateMutateAsync.mockClear();
  mockDeleteMutateAsync.mockClear();
  mockRestoreMutate.mockClear();
  mockShowUndoSnackbar.mockClear();
  mockSetProfile.mockClear();
});

describe('AddFoodEntryScreen — Profil-Auswahl (#65)', () => {
  beforeEach(() => {
    mockParams = { date: '2026-08-10', mealType: 'lunch' };
    mockChildProfiles = [{ id: 'child-1', display_name: 'Mia' }];
  });

  it('zeigt keine Profil-Auswahl ohne Kinderprofile', async () => {
    mockChildProfiles = [];
    await renderScreen();
    expect(screen.queryByText('Für wen?')).not.toBeOnTheScreen();
  });

  it('zeigt "Ich" und alle Kinderprofile, wenn Kinderprofile vorhanden sind', async () => {
    await renderScreen();
    expect(screen.getByText('Für wen?')).toBeTruthy();
    expect(screen.getByText('Ich')).toBeTruthy();
    expect(screen.getByText('Mia')).toBeTruthy();
  });

  it('waehlt beim Antippen eines Kindes dessen Profil', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Mia'));
    expect(mockSetProfile).toHaveBeenCalledWith({
      type: 'child',
      childProfileId: 'child-1',
      householdId: 'hh-1',
    });
  });

  it('blendet die Profil-Auswahl beim Bearbeiten eines Eintrags aus', async () => {
    mockParams = { date: '2026-08-10', mealType: 'dinner', entryId: 'entry-1' };
    mockFoodEntries = [
      {
        id: 'entry-1',
        name: 'Reis',
        quantity: 150,
        unit: 'g',
        kcal: 195,
        protein_g: 4,
        carbs_g: 43,
        fat_g: 0.5,
        meal_type: 'dinner',
      },
    ];
    await renderScreen();
    expect(screen.queryByText('Für wen?')).not.toBeOnTheScreen();
  });
});

describe('AddFoodEntryScreen — Produkt aus der Suche (100g-Referenz)', () => {
  beforeEach(() => {
    mockParams = {
      date: '2026-08-10',
      mealType: 'breakfast',
      name: 'Hafermilch Barista',
      brand: 'Oatly',
      kcalPer100g: '59',
      proteinPer100g: '1.1',
      carbsPer100g: '6.6',
      fatPer100g: '3',
      nutrientLevels: JSON.stringify({ fat: 'low', sugars: 'high' }),
    };
  });

  it('befuellt Name, Marke und die 100g-Werte bei Menge 100', async () => {
    await renderScreen();
    expect(screen.getByDisplayValue('Hafermilch Barista')).toBeTruthy();
    expect(screen.getByText('Oatly')).toBeTruthy();
    expect(screen.getByDisplayValue('59')).toBeTruthy();
  });

  it('zeigt aus nutrient_levels abgeleitete Bewertungs-Badges', async () => {
    await renderScreen();
    expect(screen.getByText(/Fettarm/)).toBeTruthy();
    expect(screen.getByText(/Viel Zucker/)).toBeTruthy();
  });

  it('skaliert kcal live, wenn die Menge geaendert wird', async () => {
    await renderScreen();
    const quantityField = screen.getByDisplayValue('100');
    await fireEvent.changeText(quantityField, '200');
    expect(screen.getByDisplayValue('118')).toBeTruthy(); // 59 kcal/100g * 200g / 100
  });

  it('zeigt einen Hinweis statt stiller Skalierung bei stueckbasierten Einheiten', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Stück'));
    expect(
      screen.getByText(/Automatische Umrechnung für diese Einheit nicht möglich/),
    ).toBeTruthy();
    expect(screen.getByDisplayValue('59')).toBeTruthy(); // Rohwert bleibt unveraendert stehen
  });

  it('speichert einen neuen Eintrag mit den berechneten Werten', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Speichern'));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        loggedOn: '2026-08-10',
        mealType: 'breakfast',
        name: 'Hafermilch Barista',
        quantity: 100,
        unit: 'g',
        kcal: 59,
      }),
    );
    expect(router.back).toHaveBeenCalled();
  });
});

describe('AddFoodEntryScreen — Schneller Eintrag (ohne Produktdaten)', () => {
  beforeEach(() => {
    mockParams = { date: '2026-08-10', mealType: 'lunch' };
  });

  it('startet mit einem leeren Formular', async () => {
    await renderScreen();
    expect(screen.getByPlaceholderText('Name des Lebensmittels').props.value).toBe('');
  });
});

describe('AddFoodEntryScreen — bestehenden Eintrag bearbeiten', () => {
  beforeEach(() => {
    mockParams = { date: '2026-08-10', mealType: 'dinner', entryId: 'entry-1' };
    mockFoodEntries = [
      {
        id: 'entry-1',
        name: 'Reis',
        quantity: 150,
        unit: 'g',
        kcal: 195,
        protein_g: 4,
        carbs_g: 43,
        fat_g: 0.5,
        meal_type: 'dinner',
      },
    ];
  });

  it('befuellt das Formular aus dem bestehenden Eintrag', async () => {
    await renderScreen();
    expect(screen.getByDisplayValue('Reis')).toBeTruthy();
    expect(screen.getByDisplayValue('195')).toBeTruthy();
    expect(screen.getByText('Löschen')).toBeTruthy();
  });

  it('loescht sofort ohne Bestaetigungsdialog und zeigt eine Undo-Snackbar (#86)', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Löschen'));

    expect(mockDeleteMutateAsync).toHaveBeenCalledWith({
      id: 'entry-1',
      userId: 'user-1',
      loggedOn: '2026-08-10',
    });
    expect(router.back).toHaveBeenCalled();
    expect(mockShowUndoSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ message: '"Reis" gelöscht', onUndo: expect.any(Function) }),
    );

    const { onUndo } = mockShowUndoSnackbar.mock.calls[0][0];
    onUndo();
    expect(mockRestoreMutate).toHaveBeenCalledWith({
      id: 'entry-1',
      userId: 'user-1',
      loggedOn: '2026-08-10',
    });
  });
});
