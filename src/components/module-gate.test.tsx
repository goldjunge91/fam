import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ModuleGate } from '@/components/module-gate';
import type { FeatureId } from '@/constants/feature-registry';
import type { ModulePreferences } from '@/features/settings/module-preferences';

let mockModules: ModulePreferences | undefined;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

let mockFeatureFlagState: boolean | undefined = true;
const mockGetFeatureFlagState = jest.fn((_key: string | undefined) => mockFeatureFlagState);

jest.mock('@/features/settings/use-feature-access', () => ({
  useFeatureAccess: () => ({
    get modules() {
      return mockModules;
    },
    getFeatureFlagState: mockGetFeatureFlagState,
  }),
}));

function renderGate(feature: FeatureId, title?: string) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <ModuleGate feature={feature} title={title}>
        <Text>Echter Inhalt</Text>
      </ModuleGate>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockModules = {
    fridge: true,
    shoppingList: true,
    calories: true,
    recipes: true,
    mealPlanner: true,
  };
  mockFeatureFlagState = true;
  (router.push as jest.Mock).mockClear();
  mockGetFeatureFlagState.mockClear();
});

describe('ModuleGate', () => {
  it('rendert die Kinder, wenn das Modul aktiviert ist', async () => {
    await renderGate('fridge');
    expect(screen.getByText('Echter Inhalt')).toBeTruthy();
  });

  it('rendert die Kinder optimistisch, solange die Praeferenz noch laedt', async () => {
    mockModules = undefined;
    await renderGate('fridge');
    expect(screen.getByText('Echter Inhalt')).toBeTruthy();
  });

  it('zeigt einen Hinweis statt der Kinder, wenn das Modul deaktiviert ist', async () => {
    mockModules = {
      fridge: false,
      shoppingList: true,
      calories: true,
      recipes: true,
      mealPlanner: true,
    };
    await renderGate('fridge');

    expect(screen.queryByText('Echter Inhalt')).toBeNull();
    expect(screen.getByText('Modul nicht aktiviert')).toBeTruthy();

    await fireEvent.press(screen.getByText('In den Einstellungen aktivieren'));
    expect(router.push).toHaveBeenCalledWith('/settings/modules');
  });

  it('rendert die Kinder eines Moduls ohne Remote-Flag unveraendert (kein Flag-Block)', async () => {
    await renderGate('fridge');
    expect(screen.getByText('Echter Inhalt')).toBeTruthy();
    expect(mockGetFeatureFlagState).toHaveBeenCalledWith(undefined);
  });

  it('rendert die Kinder wenn Nutzer-Praeferenz UND Feature-Flag beide zustimmen', async () => {
    mockFeatureFlagState = true;
    await renderGate('recipes');

    expect(screen.getByText('Echter Inhalt')).toBeTruthy();
    expect(mockGetFeatureFlagState).toHaveBeenCalledWith('module-recipes');
  });

  it('rendert die Kinder optimistisch, solange der Feature-Flag noch nicht bestaetigt ist (undefined)', async () => {
    mockFeatureFlagState = undefined;
    await renderGate('recipes');

    expect(screen.getByText('Echter Inhalt')).toBeTruthy();
    expect(screen.queryByText('Noch nicht verfügbar')).toBeNull();
  });

  it('zeigt einen "noch nicht verfuegbar"-Hinweis ohne Einstellungen-Knopf, wenn der Feature-Flag explizit false ist', async () => {
    mockFeatureFlagState = false;
    await renderGate('recipes');

    expect(screen.queryByText('Echter Inhalt')).toBeNull();
    expect(screen.getByText('Noch nicht verfügbar')).toBeTruthy();
    expect(screen.queryByText('In den Einstellungen aktivieren')).toBeNull();
  });

  it('zeigt den Einstellungen-Hinweis, wenn der Nutzer das Modul selbst deaktiviert hat', async () => {
    if (mockModules) mockModules.recipes = false;
    mockFeatureFlagState = true;
    await renderGate('recipes');

    expect(screen.getByText('Modul nicht aktiviert')).toBeTruthy();
    expect(screen.queryByText('Noch nicht verfügbar')).toBeNull();
  });

  it('beachtet parentModule bei Sub-Features (z.B. workouts unter calories)', async () => {
    if (mockModules) mockModules.calories = false;
    mockFeatureFlagState = true;
    await renderGate('workouts');

    expect(screen.getByText('Modul nicht aktiviert')).toBeTruthy();
  });

  it('wirft in DEV bei unbekannter Feature-ID einen Fehler', async () => {
    // Suppress console.error from React error boundary during the expected throw test
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderGate('unknown-feature-id' as unknown as FeatureId)).rejects.toThrow(
      /Unbekannte FeatureId/,
    );
    consoleError.mockRestore();
  });
});
