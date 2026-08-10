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

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <ModuleGate module="fridge" title="Vorrat">
        <Text>Echter Inhalt</Text>
      </ModuleGate>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockModules = { fridge: true, shoppingList: true, calories: true, recipes: true };
  (router.push as jest.Mock).mockClear();
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
});
