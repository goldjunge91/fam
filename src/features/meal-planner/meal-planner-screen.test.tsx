import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MealPlannerScreen } from './meal-planner-screen';

function renderScreen() {
  // `Screen` liest die Safe-Area-Insets; ohne Provider und ohne gemessene
  // Rahmenwerte wirft der Hook (siehe settings-screen.test.tsx).
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <MealPlannerScreen />
    </SafeAreaProvider>,
  );
}

const mockEnsureMutate = jest.fn();
const mockEnsureMutateAsync = jest.fn().mockResolvedValue({ id: 'plan-1' });
const mockReuseMutate = jest.fn();

// Stabile Objektidentitaet noetig: `AutoBackButton` (Screen) haengt seinen
// Effekt an `[navigation]` - ein bei jedem Aufruf neu erzeugtes Objekt
// triggert den Effekt jedes Mal erneut und damit eine Endlosschleife aus
// setState-Aufrufen.
const mockNavigation = { canGoBack: () => true, addListener: () => () => {} };

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
  // `Screen` fragt bei einem `back`-Ziel ohne `href` per `useNavigation()`,
  // ob es etwas zum Zurueckgehen gibt (AutoBackButton) — ausserhalb eines
  // Navigators gibt es dafuer keinen echten Kontext.
  useNavigation: () => mockNavigation,
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('@/features/household/api', () => ({
  useHouseholdMembers: () => ({ data: [{ id: 'user-1' }, { id: 'user-2' }] }),
}));

jest.mock('@/features/recipes/use-recipes', () => ({
  useRecipes: () => ({
    data: [{ id: 'r1', title: 'Spaghetti Bolognese', cover_image_path: null }],
  }),
}));

// Die Drag-Card im Tray zeigt das Rezeptbild ueber `useRecipeCoverUrl` (echtes
// `useQuery`) — ohne QueryClientProvider in diesem Test-Setup wuerde das
// werfen, siehe react-query-Fehlermeldung "No QueryClient set".
jest.mock('@/features/recipes/recipe-image-uploader', () => ({
  useRecipeCoverUrl: () => ({ data: null }),
}));

jest.mock('./settings', () => ({
  usePortionsPerPerson: () => ({ data: 1.25 }),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openDrawer: jest.fn(), openProfile: jest.fn() }),
}));

jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileInitials: () => 'MM',
}));

const mockAddMutate = jest.fn();

jest.mock('./use-meal-plans', () => ({
  useMealPlan: () => ({
    data: { id: 'plan-1', name: 'Woche 34', week_start_date: '2026-08-17' },
    isLoading: false,
  }),
  useMealPlanEntriesInRange: () => ({
    data: [
      {
        id: 'entry-1',
        meal_plan_id: 'plan-1',
        household_id: 'hh-1',
        recipe_id: 'r1',
        entry_date: '2026-08-17',
        meal_slot: 'dinner',
        servings_mode: 'portions',
        portions: 4,
        people_count: null,
        recipe_title: 'Spaghetti Bolognese',
      },
    ],
  }),
  useEnsureMealPlanMutation: () => ({
    mutate: mockEnsureMutate,
    mutateAsync: mockEnsureMutateAsync,
  }),
  useAddEntryMutation: () => ({ mutate: mockAddMutate }),
  useUpdateEntryMutation: () => ({ mutate: jest.fn() }),
  useDeleteEntryMutation: () => ({ mutate: jest.fn() }),
  useReuseLastWeekMutation: () => ({ mutate: mockReuseMutate }),
}));

beforeEach(() => {
  mockEnsureMutate.mockClear();
  mockEnsureMutateAsync.mockClear();
  mockReuseMutate.mockClear();
  mockAddMutate.mockClear();
});

describe('MealPlannerScreen', () => {
  it('zeigt den Titel und den zugeordneten Wochenplan-Eintrag', async () => {
    await renderScreen();

    expect(screen.getByText('Essensplan')).toBeOnTheScreen();
    // `getByText` waere hier mehrdeutig: das Zieh-Tray listet denselben
    // Rezeptnamen zusaetzlich als Vorschlag. Der Kalendereintrag selbst hat
    // ein eigenes `aria-label`, darueber ist er eindeutig zu finden.
    expect(
      screen.getByRole('button', { name: 'Spaghetti Bolognese, 4 Portionen' }),
    ).toBeOnTheScreen();
  });

  it('zeigt die Ansichts-Umschalter Tag/3 Tage/Woche, Woche als Standard', async () => {
    await renderScreen();

    expect(screen.getByRole('tab', { name: 'Tag-Ansicht' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '3 Tage-Ansicht' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Woche-Ansicht', selected: true })).toBeOnTheScreen();
  });

  it('blendet die wochenweiten Aktionen in der Tagesansicht aus', async () => {
    const user = userEvent.setup();
    await renderScreen();

    expect(screen.getByRole('button', { name: 'Vorwoche übernehmen' })).toBeOnTheScreen();

    await user.press(screen.getByRole('tab', { name: 'Tag-Ansicht' }));

    expect(screen.queryByRole('button', { name: 'Vorwoche übernehmen' })).not.toBeOnTheScreen();
  });

  it('loest "letzte Woche erneut verwenden" ueber die Mutation aus', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Vorwoche übernehmen' }));

    expect(mockReuseMutate).toHaveBeenCalledWith(
      expect.objectContaining({ household_id: 'hh-1', target_meal_plan_id: 'plan-1' }),
      expect.anything(),
    );
  });

  it('oeffnet beim Tippen auf eine leere Zelle den Rezept-Picker und traegt die Auswahl ein (#129-Nachtrag)', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(
      screen.getByRole('button', { name: 'Frühstück am Montag, Gericht hinzufügen' }),
    );

    expect(screen.getByText('Rezept auswählen')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Spaghetti Bolognese eintragen' }));

    // Rezept-Picker schliesst sich, Portionen-/Personen-Formular oeffnet sich fuer die Auswahl.
    expect(screen.queryByText('Rezept auswählen')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeOnTheScreen();
  });
});
