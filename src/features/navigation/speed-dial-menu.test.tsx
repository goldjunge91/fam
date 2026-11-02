import { render, screen, userEvent } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SpeedDialMenu } from '@/features/navigation/speed-dial-menu';
import type { ModulePreferences } from '@/features/settings/module-preferences';
import type { FeatureFlagKey } from '@/lib/observability/providers/posthog';

const mockCloseQuickAdd = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterSetParams = jest.fn();
let mockPathname = '/';
let mockQuickAddOpen = true;
let mockFabPosition: 'left' | 'right' = 'right';
let mockModulePreferences: ModulePreferences = {
  fridge: true,
  shoppingList: true,
  calories: true,
  recipes: true,
  mealPlanner: true,
};
let mockFeatureFlags: Record<FeatureFlagKey, boolean> = {
  'test-feature': false,
  'shopping-category-feedback-alpha': false,
  'shopping-stt': true,
  'workout-log': false,
  'low-carb-tracking': false,
  'module-recipes': true,
  'module-meal-planner': true,
  'module-calories': true,
  'tracking-method-fasting': false,
  'tracking-method-keto': false,
  'tracking-method-cgm': false,
  'tracking-method-volumetrics': false,
  'bug-bubble': false,
  bugbubble: false,
  'dev-tools': false,
};

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
    setParams: (...args: unknown[]) => mockRouterSetParams(...args),
  },
  usePathname: () => mockPathname,
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({
    isQuickAddOpen: mockQuickAddOpen,
    closeQuickAdd: mockCloseQuickAdd,
  }),
}));

jest.mock('@/features/navigation/fab-position-settings', () => ({
  DEFAULT_FAB_POSITION: 'right',
  useFabPosition: () => ({ data: mockFabPosition }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/settings/module-preferences', () => ({
  useModulePreferences: () => ({
    data: mockModulePreferences,
  }),
}));

jest.mock('@/lib/observability/providers/posthog', () => ({
  useFeatureFlags: () => mockFeatureFlags,
  useFeatureFlag: (key: FeatureFlagKey, defaultValue: boolean) =>
    mockFeatureFlags[key] ?? defaultValue,
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
    jest.clearAllMocks();
    mockPathname = '/';
    mockQuickAddOpen = true;
    mockFabPosition = 'right';
    mockModulePreferences = {
      fridge: true,
      shoppingList: true,
      calories: true,
      recipes: true,
      mealPlanner: true,
    };
    mockFeatureFlags = {
      'test-feature': false,
      'shopping-category-feedback-alpha': false,
      'shopping-stt': true,
      'workout-log': false,
      'low-carb-tracking': false,
      'module-recipes': true,
      'module-meal-planner': true,
      'module-calories': true,
      'tracking-method-fasting': false,
      'tracking-method-keto': false,
      'tracking-method-cgm': false,
      'tracking-method-volumetrics': false,
      'bug-bubble': false,
      bugbubble: false,
      'dev-tools': false,
    };
  });

  afterEach(() => jest.restoreAllMocks());

  it('blendet die Schnellauswahl in der Prospektansicht aus', async () => {
    mockPathname = '/(app)/brochures/brochure-1';

    await renderSpeedDial();

    expect(screen.queryByText('Vorratsartikel')).not.toBeOnTheScreen();
    expect(screen.queryByText('Einkaufsartikel')).not.toBeOnTheScreen();
  });

  it('blendet die Schnellauswahl auch in der Prospektübersicht aus', async () => {
    mockPathname = '/brochures';

    await renderSpeedDial();

    expect(screen.queryByText('Vorratsartikel')).not.toBeOnTheScreen();
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

  it('blendet die Spracheingabe aus, wenn shopping-stt deaktiviert ist', async () => {
    mockFeatureFlags['shopping-stt'] = false;

    await renderSpeedDial();

    expect(screen.queryByRole('button', { name: 'Spracheingabe' })).not.toBeOnTheScreen();
    expect(screen.getByText('Einkaufsartikel')).toBeOnTheScreen();
  });

  it('schliesst Quick-Add und öffnet den Vorratsartikel-Workflow', async () => {
    const user = userEvent.setup();
    await renderSpeedDial();

    await user.press(screen.getByRole('button', { name: 'Vorratsartikel' }));

    expect(mockCloseQuickAdd).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/add-item');
  });

  it('setzt auf der Einkaufsliste die Spracheingabe als lokale Aktion', async () => {
    mockPathname = '/shopping-list';
    const user = userEvent.setup();
    await renderSpeedDial();

    await user.press(screen.getByRole('button', { name: 'Spracheingabe' }));

    expect(mockCloseQuickAdd).toHaveBeenCalledTimes(1);
    expect(mockRouterSetParams).toHaveBeenCalledWith({ action: 'voice' });
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('öffnet Spracheingabe aus anderen Routen und schliesst über den Hintergrund', async () => {
    const user = userEvent.setup();
    await renderSpeedDial();

    await user.press(screen.getByRole('button', { name: 'Spracheingabe' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/shopping-list?action=voice');

    await user.press(screen.getByRole('button', { name: 'Schließen' }));
    expect(mockCloseQuickAdd).toHaveBeenCalledTimes(2);
  });

  it('verbraucht den Hardware-Zurück-Klick und entfernt den Listener beim Unmount', async () => {
    const remove = jest.fn();
    let onHardwareBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_eventName, handler) => {
      onHardwareBack = handler;
      return { remove };
    });
    const { unmount } = await renderSpeedDial();

    if (!onHardwareBack) throw new Error('Expected the hardware back press handler');
    expect(onHardwareBack({ type: 'hardwareBackPress', timeStamp: 1 })).toBe(true);
    expect(mockCloseQuickAdd).toHaveBeenCalledTimes(1);
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('blendet die Ernährungstracking-Aktion aus, wenn das Kalorien-Modul deaktiviert ist', async () => {
    mockModulePreferences.calories = false;

    await renderSpeedDial();

    expect(screen.queryByText('Tagebucheintrag')).not.toBeOnTheScreen();
    expect(screen.getByText('Vorratsartikel')).toBeOnTheScreen();
  });

  it('blendet die Ernährungstracking-Aktion aus, wenn module-calories deaktiviert ist', async () => {
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
