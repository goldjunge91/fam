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
  useTheme: () => require('@/components/theme/index').Colors.light,
}));

let mockFeatureFlags: Record<string, boolean> = {
  'module-recipes': true,
  'module-meal-planner': true,
  'module-calories': true,
};

jest.mock('@/lib/posthog', () => ({
  useFeatureFlags: () => mockFeatureFlags,
  useFeatureFlag: (key: string | undefined, defaultValue: boolean) =>
    key ? (mockFeatureFlags[key] ?? defaultValue) : defaultValue,
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
  mockFeatureFlags = {
    'module-recipes': true,
    'module-meal-planner': true,
    'module-calories': true,
  };
});

describe('ModuleSettingsScreen', () => {
  it('zeigt alle fünf Module mit ihrem aktuellen Zustand', async () => {
    await renderScreen();
    expect(screen.getByText(/Kühlschrank & Vorrat/)).toBeTruthy();
    expect(screen.getByText(/Geteilte Einkaufsliste/)).toBeTruthy();
    expect(screen.getByText(/Kalorienzähler & Tagebuch/)).toBeTruthy();
    expect(screen.getByText(/Rezepte/)).toBeTruthy();
    expect(screen.getByText(/Essensplan/)).toBeTruthy();
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

  it('zeigt "Demnächst verfügbar" und ignoriert Taps, wenn der Feature-Flag eines Moduls aus ist', async () => {
    mockFeatureFlags['module-calories'] = false;
    await renderScreen();

    expect(screen.getByText('Demnächst verfügbar')).toBeTruthy();

    await fireEvent.press(screen.getByText(/Kalorienzähler & Tagebuch/));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('laesst Vorrat und Einkauf unberuehrt vom Feature-Flag-Zustand', async () => {
    mockFeatureFlags = {
      'module-recipes': false,
      'module-meal-planner': false,
      'module-calories': false,
    };
    await renderScreen();

    await fireEvent.press(screen.getByText(/Geteilte Einkaufsliste/));
    expect(mockMutate).toHaveBeenCalledWith({
      userId: 'user-1',
      modules: { shoppingList: false },
    });
  });
});
