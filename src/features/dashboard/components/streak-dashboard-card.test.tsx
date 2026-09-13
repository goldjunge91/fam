import { render, screen } from '@testing-library/react-native';

import { i18n } from '@/i18n';
import { StreakDashboardCard } from './streak-dashboard-card';

let mockStreak = { count: 3, best: 7, activeToday: true };

jest.mock('@/lib/streak', () => ({
  useStreak: () => mockStreak,
}));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: require('@/components/theme/index').Colors.light }),
}));

describe('StreakDashboardCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockStreak = { count: 3, best: 7, activeToday: true };
  });

  it('zeigt die allgemeine Serie im kleinen Modus kompakt an', async () => {
    await render(<StreakDashboardCard size="small" />);

    expect(screen.getByText('STREAK')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('Tage')).toBeOnTheScreen();
    expect(screen.queryByText('🔥')).toBeNull();
    expect(screen.queryByText('Tage am Stück')).toBeNull();
    expect(screen.queryByTestId('streak-day-1')).toBeNull();
    expect(screen.queryByText('Heute aktiv')).toBeNull();
    expect(screen.queryByText('Bester Wert: 7 Tage')).toBeNull();
  });

  it('zeigt im großen Modus Status und Rekord', async () => {
    mockStreak = { count: 0, best: 7, activeToday: false };
    await render(<StreakDashboardCard size="large" />);

    expect(screen.getByText('🔥')).toBeOnTheScreen();
    expect(screen.getByTestId('streak-day-1')).toBeOnTheScreen();
    expect(screen.getByText('Neue Serie starten')).toBeOnTheScreen();
    expect(screen.getByText('Bester Wert: 7 Tage')).toBeOnTheScreen();
  });
});
