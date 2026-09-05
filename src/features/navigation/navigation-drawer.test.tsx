import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavigationDrawer } from '@/features/navigation/navigation-drawer';

const mockPush = jest.fn();
const mockCloseDrawer = jest.fn();
let mockPathname = '/';

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  usePathname: () => mockPathname,
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/settings/module-preferences', () => ({
  DEFAULT_MODULE_PREFERENCES: {
    fridge: true,
    shoppingList: true,
    recipes: true,
    mealPlanner: true,
    calories: true,
  },
  useModulePreferences: () => ({
    data: {
      fridge: true,
      shoppingList: true,
      recipes: true,
      mealPlanner: true,
      calories: true,
    },
    isLoading: false,
  }),
}));

jest.mock('./navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({
    isDrawerOpen: true,
    closeDrawer: mockCloseDrawer,
  }),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({
    isDrawerOpen: true,
    closeDrawer: mockCloseDrawer,
  }),
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

describe('NavigationDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/';
    mockFeatureFlags = {
      'module-recipes': true,
      'module-meal-planner': true,
      'module-calories': true,
    };
  });

  it('rendert alle aktiven Navigationsziele', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <NavigationDrawer />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Übersicht')).toBeTruthy();
    expect(screen.getByText('Vorrat')).toBeTruthy();
    expect(screen.getByText('Einkauf')).toBeTruthy();
    expect(screen.getByText('Rezepte')).toBeTruthy();
    expect(screen.getByText('Essensplan')).toBeTruthy();
    expect(screen.getByText('Tagebuch')).toBeTruthy();
    expect(screen.getByText('Einstellungen')).toBeTruthy();
    expect(screen.queryByText('HAUSHALT & PLANUNG')).toBeNull();
    expect(screen.queryByText('PRIVAT')).toBeNull();
  });

  it('navigiert beim Klick auf ein Ziel und schließt den Drawer', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <NavigationDrawer />
      </SafeAreaProvider>,
    );

    const vorratBtn = screen.getByText('Vorrat');
    fireEvent.press(vorratBtn);

    expect(mockCloseDrawer).toHaveBeenCalled();
  });

  it('markiert den aktuellen Bereich auch auf Unterseiten', async () => {
    mockPathname = '/(app)/fridge/details';

    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <NavigationDrawer />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Vorrat').parent?.props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText('Übersicht').parent?.props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('markiert Einstellungen auf allen Einstellungs-Unterseiten', async () => {
    mockPathname = '/settings/profile';

    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <NavigationDrawer />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Einstellungen').parent?.props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('blendet ein Ziel aus, dessen Feature-Flag aus ist, obwohl die Nutzer-Praeferenz an ist', async () => {
    mockFeatureFlags['module-recipes'] = false;

    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <NavigationDrawer />
      </SafeAreaProvider>,
    );

    expect(screen.queryByText('Rezepte')).toBeNull();
    // Vorrat/Einkauf sind vom Feature-Flag-Gate ausgenommen, bleiben sichtbar.
    expect(screen.getByText('Vorrat')).toBeTruthy();
    expect(screen.getByText('Einkauf')).toBeTruthy();
    expect(screen.getByText('Essensplan')).toBeTruthy();
    expect(screen.getByText('Tagebuch')).toBeTruthy();
  });
});
