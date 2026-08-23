import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RecipeLayout from '../../app/recipe/_layout';

let mockRecipesPreference = true;
let mockRecipesFeatureFlag: boolean | undefined = true;

function mockSlot() {
  return <Text>Ausgewählter Rezept-Routeninhalt</Text>;
}

jest.mock('expo-router', () => ({
  Slot: mockSlot,
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/settings/module-preferences', () => ({
  useModulePreferences: () => ({
    data: {
      fridge: true,
      shoppingList: true,
      calories: true,
      recipes: mockRecipesPreference,
      mealPlanner: true,
    },
  }),
}));

jest.mock('@/lib/posthog', () => ({
  useFeatureFlagState: () => mockRecipesFeatureFlag,
}));

function renderLayout() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <RecipeLayout />
    </SafeAreaProvider>,
  );
}

describe('RecipeLayout', () => {
  beforeEach(() => {
    mockRecipesPreference = true;
    mockRecipesFeatureFlag = true;
  });

  it('rendert die ausgewählte Rezept-Route, wenn Präferenz und Feature-Flag aktiv sind', async () => {
    await renderLayout();

    expect(screen.getByText('Ausgewählter Rezept-Routeninhalt')).toBeOnTheScreen();
  });

  it('blockiert den gesamten Rezept-Routenstack, wenn module-recipes deaktiviert ist', async () => {
    mockRecipesFeatureFlag = false;

    await renderLayout();

    expect(screen.queryByText('Ausgewählter Rezept-Routeninhalt')).not.toBeOnTheScreen();
    expect(screen.getByText('Noch nicht verfügbar')).toBeOnTheScreen();
  });

  it('blockiert den gesamten Rezept-Routenstack, wenn das Rezepte-Modul deaktiviert ist', async () => {
    mockRecipesPreference = false;

    await renderLayout();

    expect(screen.queryByText('Ausgewählter Rezept-Routeninhalt')).not.toBeOnTheScreen();
    expect(screen.getByText('Modul nicht aktiviert')).toBeOnTheScreen();
  });
});
