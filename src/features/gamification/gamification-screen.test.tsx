import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { celebrate } from '@/features/gamification/celebration';
import { GamificationScreen } from './gamification-screen';

let mockStreak = { count: 3, best: 7, activeToday: true };

jest.mock('@/features/gamification/celebration', () => ({
  celebrate: jest.fn(),
}));

jest.mock('@/features/gamification/streak', () => ({
  useStreak: () => mockStreak,
}));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => {
    const theme = require('@/components/theme/index');
    return { colors: theme.colorsLight, accent: theme.makeAccent(theme.colorsLight) };
  },
  useThemedStyles: (
    factory: (colors: typeof import('@/components/theme/index').colorsLight) => unknown,
  ) => factory(require('@/components/theme/index').colorsLight),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <GamificationScreen />
    </SafeAreaProvider>,
  );
}

describe('GamificationScreen', () => {
  beforeEach(() => {
    mockStreak = { count: 3, best: 7, activeToday: true };
    jest.mocked(celebrate).mockClear();
  });

  it('zeigt die aktuelle Serie, den heutigen Status und den Rekord', async () => {
    await renderScreen();

    expect(screen.getByText('Gamification')).toBeOnTheScreen();
    expect(screen.getByText('DEIN STREAK')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('Heute aktiv')).toBeOnTheScreen();
    expect(screen.getAllByText('7 Tage')).toHaveLength(2);
  });

  it('bietet im Development-Bereich testbare Celebrations an', async () => {
    await renderScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Celebration ohne Nachricht' }));
    await user.press(screen.getByRole('button', { name: 'Celebration mit Nachricht' }));
    await user.press(screen.getByRole('button', { name: 'Streak-Badge testen' }));

    expect(celebrate).toHaveBeenNthCalledWith(1);
    expect(celebrate).toHaveBeenNthCalledWith(2, '🎉 Celebration getestet');
    expect(celebrate).toHaveBeenNthCalledWith(3, '🔥 7 Tage Streak!');
  });

  it('erklärt den Start der ersten Serie und zeigt das erste Ziel', async () => {
    mockStreak = { count: 0, best: 0, activeToday: false };

    await renderScreen();

    expect(screen.getByText('Starte deine erste Serie')).toBeOnTheScreen();
    expect(screen.getByText('0')).toBeOnTheScreen();
    expect(screen.getByText('3 Tage')).toBeOnTheScreen();
  });

  it('bietet nach einem früheren Rekord einen Neustart an', async () => {
    mockStreak = { count: 0, best: 4, activeToday: false };

    await renderScreen();

    expect(screen.getByText('Neue Serie starten')).toBeOnTheScreen();
  });

  it('zeigt den gestrigen Aktivstatus, Einzahl und das nächste Meilensteinziel', async () => {
    mockStreak = { count: 1, best: 1, activeToday: false };

    await renderScreen();

    expect(screen.getByText('Gestern aktiv')).toBeOnTheScreen();
    expect(screen.getByText('Tag am Stück')).toBeOnTheScreen();
    expect(screen.getByText('3 Tage')).toBeOnTheScreen();
  });

  it('setzt nach dem letzten Meilenstein das nächste Ziel fort', async () => {
    mockStreak = { count: 365, best: 365, activeToday: true };

    await renderScreen();

    expect(screen.getByText('366 Tage')).toBeOnTheScreen();
  });
});
