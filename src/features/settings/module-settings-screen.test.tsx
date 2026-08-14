import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ModuleSettingsScreen } from '@/features/settings/module-settings-screen';

const mockMutate = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/settings/module-preferences', () => ({
  useModulePreferences: () => ({
    data: { fridge: true, shoppingList: true, calories: false, recipes: true, mealPlanner: true },
    isLoading: false,
  }),
  useUpdateModulePreferencesMutation: () => ({ mutate: mockMutate, isPending: false }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <ModuleSettingsScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockMutate.mockClear();
});

describe('ModuleSettingsScreen', () => {
  it('zeigt alle fünf Module mit ihrem aktuellen Zustand', async () => {
    await renderScreen();
    expect(screen.getByText(/Kühlschrank & Vorrat/)).toBeTruthy();
    expect(screen.getByText(/Geteilte Einkaufsliste/)).toBeTruthy();
    expect(screen.getByText(/Kalorienzähler & Tagebuch/)).toBeTruthy();
    expect(screen.getByText(/Rezepte/)).toBeTruthy();
    expect(screen.getByText(/Meal-Planner/)).toBeTruthy();
  });

  it('schaltet ein aktiviertes Modul beim Antippen aus', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText(/Geteilte Einkaufsliste/));

    expect(mockMutate).toHaveBeenCalledWith({
      userId: 'user-1',
      modules: { shoppingList: false },
    });
  });

  it('schaltet ein deaktiviertes Modul beim Antippen ein', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText(/Kalorienzähler & Tagebuch/));

    expect(mockMutate).toHaveBeenCalledWith({
      userId: 'user-1',
      modules: { calories: true },
    });
  });
});
