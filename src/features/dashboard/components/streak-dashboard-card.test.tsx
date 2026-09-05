import { render, screen } from '@testing-library/react-native';

import { StreakDashboardCard } from './streak-dashboard-card';

let mockStreak = { count: 3, best: 7, activeToday: true };

jest.mock('@/lib/streak', () => ({
  useStreak: () => mockStreak,
}));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: require('@/components/theme/index').Colors.light }),
}));

describe('StreakDashboardCard', () => {
  beforeEach(() => {
    mockStreak = { count: 3, best: 7, activeToday: true };
  });

  it('zeigt die aktuelle Serie, den heutigen Status und den Rekord', async () => {
    await render(<StreakDashboardCard size="small" />);

    expect(screen.getByText('KOCHSTREAK')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('Heute aktiv')).toBeOnTheScreen();
    expect(screen.getByText('Bester Wert: 7 Tage')).toBeOnTheScreen();
  });

  it('zeigt bei einer unterbrochenen Serie einen Neustart-Hinweis', async () => {
    mockStreak = { count: 0, best: 7, activeToday: false };
    await render(<StreakDashboardCard size="large" />);

    expect(screen.getByText('Neue Serie starten')).toBeOnTheScreen();
    expect(screen.getByText('Bester Wert: 7 Tage')).toBeOnTheScreen();
  });
});
