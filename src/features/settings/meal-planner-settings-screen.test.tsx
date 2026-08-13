import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MealPlannerSettingsScreen } from './meal-planner-settings-screen';

const mockNavigation = { canGoBack: () => true, addListener: () => () => {} };
const mockSetPortionsPerPerson = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useNavigation: () => mockNavigation,
}));

jest.mock('@/features/meal-planner/settings', () => ({
  usePortionsPerPerson: () => ({ data: 1.25, isLoading: false }),
  useSetPortionsPerPerson: () => mockSetPortionsPerPerson,
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <MealPlannerSettingsScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockSetPortionsPerPerson.mockClear();
});

describe('MealPlannerSettingsScreen', () => {
  it('zeigt den aktuellen Faktor vorausgefuellt', async () => {
    await renderScreen();

    expect(screen.getByDisplayValue('1.25')).toBeOnTheScreen();
  });

  it('speichert einen geaenderten Faktor', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const input = screen.getByDisplayValue('1.25');
    await user.clear(input);
    await user.type(input, '1.5');
    await user.press(screen.getByRole('button', { name: 'Speichern' }));

    expect(mockSetPortionsPerPerson).toHaveBeenCalledWith(1.5);
    expect(await screen.findByText('Gespeichert.')).toBeOnTheScreen();
  });

  it('deaktiviert Speichern bei ungueltiger Eingabe', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const input = screen.getByDisplayValue('1.25');
    await user.clear(input);
    await user.type(input, '0');

    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });
});
