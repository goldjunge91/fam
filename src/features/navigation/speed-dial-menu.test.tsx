import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SpeedDialMenu } from '@/features/navigation/speed-dial-menu';
import type { ModulePreferences } from '@/features/settings/module-preferences';
import type { FeatureFlagKey } from '@/lib/posthog';

const mockCloseQuickAdd = jest.fn();
let mockModulePreferences: ModulePreferences = {
  fridge: true,
  shoppingList: true,
  calories: true,
  recipes: true,
  mealPlanner: true,
};
let mockFeatureFlags: Record<FeatureFlagKey, boolean> = {
  'test-feature': false,
  'workout-log': false,
  'low-carb-tracking': false,
  'module-recipes': true,
  'module-meal-planner': true,
  'module-calories': true,
};

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({
    isQuickAddOpen: true,
    closeQuickAdd: mockCloseQuickAdd,
  }),
}));

jest.mock('@/features/navigation/fab-position-settings', () => ({
  DEFAULT_FAB_POSITION: 'right',
  useFabPosition: () => ({ data: 'right' }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/settings/module-preferences', () => ({
  DEFAULT_MODULE_PREFERENCES: {
    fridge: true,
    shoppingList: true,
    calories: true,
    recipes: true,
    mealPlanner: true,
  },
  useModulePreferences: () => ({
    data: mockModulePreferences,
  }),
}));

jest.mock('@/lib/posthog', () => ({
  useFeatureFlags: () => mockFeatureFlags,
  useFeatureFlag: (key: FeatureFlagKey, defaultValue: boolean) =>
    mockFeatureFlags[key] ?? defaultValue,
}));

jest.mock('@/hooks/use-deferred-mount', () => ({
  useDeferredMount: () => true,
}));

function renderSpeedDial() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <SpeedDialMenu />
    </SafeAreaProvider>,
  );
}

describe('SpeedDialMenu', () => {
  beforeEach(() => {
    mockModulePreferences = {
      fridge: true,
      shoppingList: true,
      calories: true,
      recipes: true,
      mealPlanner: true,
    };
    mockFeatureFlags = {
      'test-feature': false,
      'workout-log': false,
      'low-carb-tracking': false,
      'module-recipes': true,
      'module-meal-planner': true,
      'module-calories': true,
    };
  });

  it('rendert Schnellauswahl-Aktionen', async () => {
    await renderSpeedDial();

    expect(screen.getByText('Vorratsartikel')).toBeOnTheScreen();
    expect(screen.getByText('Einkaufsartikel')).toBeOnTheScreen();
    expect(screen.getByText('Tagebucheintrag')).toBeOnTheScreen();
    expect(screen.getByText('Rezept')).toBeOnTheScreen();
  });

  it('blendet die Vorrats-Aktion aus, wenn das Vorrat-Modul deaktiviert ist', async () => {
    mockModulePreferences.fridge = false;

    await renderSpeedDial();

    expect(screen.queryByText('Vorratsartikel')).not.toBeOnTheScreen();
    expect(screen.getByText('Einkaufsartikel')).toBeOnTheScreen();
  });

  it('blendet die Einkaufs-Aktion aus, wenn das Einkaufs-Modul deaktiviert ist', async () => {
    mockModulePreferences.shoppingList = false;

    await renderSpeedDial();

    expect(screen.queryByText('Einkaufsartikel')).not.toBeOnTheScreen();
    expect(screen.getByText('Vorratsartikel')).toBeOnTheScreen();
  });

  it('blendet die Tagebuch-Aktion aus, wenn das Kalorien-Modul deaktiviert ist', async () => {
    mockModulePreferences.calories = false;

    await renderSpeedDial();

    expect(screen.queryByText('Tagebucheintrag')).not.toBeOnTheScreen();
    expect(screen.getByText('Vorratsartikel')).toBeOnTheScreen();
  });

  it('blendet die Tagebuch-Aktion aus, wenn module-calories deaktiviert ist', async () => {
    mockFeatureFlags['module-calories'] = false;

    await renderSpeedDial();

    expect(screen.queryByText('Tagebucheintrag')).not.toBeOnTheScreen();
    expect(screen.getByText('Vorratsartikel')).toBeOnTheScreen();
  });

  it('blendet die Rezept-Aktion aus, wenn das Rezepte-Modul deaktiviert ist', async () => {
    mockModulePreferences.recipes = false;

    await renderSpeedDial();

    expect(screen.queryByText('Rezept')).not.toBeOnTheScreen();
    expect(screen.getByText('Vorratsartikel')).toBeOnTheScreen();
  });

  it('blendet die Rezept-Aktion aus, wenn module-recipes deaktiviert ist', async () => {
    mockFeatureFlags['module-recipes'] = false;

    await renderSpeedDial();

    expect(screen.queryByText('Rezept')).not.toBeOnTheScreen();
    expect(screen.getByText('Vorratsartikel')).toBeOnTheScreen();
  });
});
