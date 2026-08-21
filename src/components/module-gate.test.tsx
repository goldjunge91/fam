import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ModuleGate } from '@/components/module-gate';

let mockModules:
  | { fridge: boolean; shoppingList: boolean; calories: boolean; recipes: boolean }
  | undefined;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/settings/module-preferences', () => ({
  useModulePreferences: () => ({ data: mockModules }),
}));

let mockFeatureFlagValue = true;
const mockUseFeatureFlag = jest.fn((_key: string, _defaultValue: boolean) => mockFeatureFlagValue);

jest.mock('@/lib/posthog', () => ({
  useFeatureFlag: (key: string, defaultValue: boolean) => mockUseFeatureFlag(key, defaultValue),
}));

function renderScreen(featureFlag?: 'module-recipes') {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <ModuleGate module="fridge" title="Vorrat" featureFlag={featureFlag}>
        <Text>Echter Inhalt</Text>
      </ModuleGate>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockModules = { fridge: true, shoppingList: true, calories: true, recipes: true };
  mockFeatureFlagValue = true;
  (router.push as jest.Mock).mockClear();
  mockUseFeatureFlag.mockClear();
});

describe('ModuleGate', () => {
  it('rendert die Kinder, wenn das Modul aktiviert ist', async () => {
    await renderScreen();
    expect(screen.getByText('Echter Inhalt')).toBeTruthy();
  });

  it('rendert die Kinder optimistisch, solange die Praeferenz noch laedt', async () => {
    mockModules = undefined;
    await renderScreen();
    expect(screen.getByText('Echter Inhalt')).toBeTruthy();
  });

  it('zeigt einen Hinweis statt der Kinder, wenn das Modul deaktiviert ist', async () => {
    mockModules = { fridge: false, shoppingList: true, calories: true, recipes: true };
    await renderScreen();

    expect(screen.queryByText('Echter Inhalt')).toBeNull();
    expect(screen.getByText('Modul nicht aktiviert')).toBeTruthy();

    await fireEvent.press(screen.getByText('In den Einstellungen aktivieren'));
    expect(router.push).toHaveBeenCalledWith('/settings/modules');
  });

  it('rendert die Kinder ohne featureFlag-Prop unveraendert (kein Flag-Check)', async () => {
    await renderScreen();
    expect(screen.getByText('Echter Inhalt')).toBeTruthy();
    // Der Hook wird laut Rules of Hooks immer aufgerufen (kein Prop -> kein
    // Key, defaultValue true -> wirkt wie kein Gate).
    expect(mockUseFeatureFlag).toHaveBeenCalledWith(undefined, true);
  });

  it('rendert die Kinder wenn Nutzer-Praeferenz UND Feature-Flag beide zustimmen', async () => {
    mockFeatureFlagValue = true;
    await renderScreen('module-recipes');

    expect(screen.getByText('Echter Inhalt')).toBeTruthy();
    expect(mockUseFeatureFlag).toHaveBeenCalledWith('module-recipes', false);
  });

  it('zeigt einen "noch nicht verfuegbar"-Hinweis ohne Einstellungen-Knopf, wenn nur der Feature-Flag aus ist', async () => {
    mockModules = { fridge: true, shoppingList: true, calories: true, recipes: true };
    mockFeatureFlagValue = false;
    await renderScreen('module-recipes');

    expect(screen.queryByText('Echter Inhalt')).toBeNull();
    expect(screen.getByText('Noch nicht verfügbar')).toBeTruthy();
    expect(screen.queryByText('In den Einstellungen aktivieren')).toBeNull();
  });

  it('zeigt den Einstellungen-Hinweis (nicht den Flag-Hinweis), wenn der Nutzer das Modul selbst deaktiviert hat', async () => {
    mockModules = { fridge: false, shoppingList: true, calories: true, recipes: true };
    mockFeatureFlagValue = true;
    await renderScreen('module-recipes');

    expect(screen.getByText('Modul nicht aktiviert')).toBeTruthy();
    expect(screen.queryByText('Noch nicht verfügbar')).toBeNull();
  });
});
