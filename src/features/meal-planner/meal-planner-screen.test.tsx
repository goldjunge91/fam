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
  useRecipes: () => ({ data: [{ id: 'r1', title: 'Spaghetti Bolognese' }] }),
}));

jest.mock('./settings', () => ({
  usePortionsPerPerson: () => ({ data: 1.25 }),
}));

jest.mock('./use-meal-plans', () => ({
  useMealPlan: () => ({
    data: { id: 'plan-1', name: 'Woche 34', week_start_date: '2026-08-17' },
    isLoading: false,
  }),
  useMealPlanEntries: () => ({
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
  useAddEntryMutation: () => ({ mutate: jest.fn() }),
  useUpdateEntryMutation: () => ({ mutate: jest.fn() }),
  useDeleteEntryMutation: () => ({ mutate: jest.fn() }),
  useReuseLastWeekMutation: () => ({ mutate: mockReuseMutate }),
}));

beforeEach(() => {
  mockEnsureMutate.mockClear();
  mockEnsureMutateAsync.mockClear();
  mockReuseMutate.mockClear();
});

describe('MealPlannerScreen', () => {
  it('zeigt den Titel und den zugeordneten Wochenplan-Eintrag', async () => {
    await renderScreen();

    expect(screen.getByText('Wochenplan')).toBeOnTheScreen();
    expect(screen.getByText('Spaghetti Bolognese')).toBeOnTheScreen();
  });

  it('loest "letzte Woche erneut verwenden" ueber die Mutation aus', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Letzte Woche erneut verwenden' }));

    expect(mockReuseMutate).toHaveBeenCalledWith(
      expect.objectContaining({ household_id: 'hh-1', target_meal_plan_id: 'plan-1' }),
      expect.anything(),
    );
  });
});
