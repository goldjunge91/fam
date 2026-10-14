import { render, screen } from '@testing-library/react-native';
import { useCurrentGoal, useFoodEntries } from '@/features/calorie-tracking/api';
import { getCards } from '@/features/dashboard/registry';
import '@/features/calorie-tracking/components/dashboard-card';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/calorie-tracking/api', () => ({
  useCurrentGoal: jest.fn(),
  useFoodEntries: jest.fn(),
}));

jest.mock('@/components/ui/progress-ring', () => {
  const React = require('react') as typeof import('react');
  const { Text } = require('react-native') as typeof import('react-native');

  return {
    ProgressRing: ({
      value,
      target,
      label,
      displayMode,
    }: {
      value: number;
      target: number;
      label: string;
      displayMode: string;
    }) =>
      React.createElement(
        Text,
        { testID: 'progress-ring' },
        `${value}/${target}:${label}:${displayMode}`,
      ),
  };
});

jest.mock('@/features/dashboard/components/dashboard-card-shell', () => {
  const React = require('react') as typeof import('react');
  const { Pressable } = require('react-native') as typeof import('react-native');

  return {
    DashboardCardShell: ({
      children,
      onLongPress,
      disabled,
      accessibilityLabel,
    }: {
      children: React.ReactNode;
      onLongPress?: () => void;
      disabled?: boolean;
      accessibilityLabel?: string;
    }) =>
      React.createElement(
        Pressable,
        { testID: 'calorie-dashboard-card', onLongPress, disabled, accessibilityLabel },
        children,
      ),
  };
});

function renderCard(size: 'small' | 'large') {
  const definition = getCards().find((card) => card.id === 'calories');
  if (!definition) throw new Error('Calories dashboard card was not registered');

  const Card = definition.component;
  return render(<Card size={size} />);
}

function mockData(dailyKcal: number | null, consumedKcal: number) {
  jest
    .mocked(useCurrentGoal)
    .mockReturnValue({ data: dailyKcal === null ? null : { daily_kcal: dailyKcal } } as never);
  jest.mocked(useFoodEntries).mockReturnValue({
    data: consumedKcal === 0 ? [] : [{ kcal: consumedKcal, protein_g: 0, carbs_g: 0, fat_g: 0 }],
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockData(null, 0);
});

describe('CalorieDashboardCard', () => {
  it('zeigt im kleinen Format den Zustand ohne Tagesziel', async () => {
    await renderCard('small');

    expect(screen.getByText('dashboard.cards.calories.titleSmall')).toBeOnTheScreen();
    expect(screen.getByText('—')).toBeOnTheScreen();
    expect(screen.getByText('dashboard.cards.calories.noGoal')).toBeOnTheScreen();
    expect(screen.getByText('0/0:kcal:count')).toBeOnTheScreen();
  });

  it('zeigt verbleibende oder überschrittene Kalorien im kleinen Format', async () => {
    mockData(2000, 500);
    await renderCard('small');
    expect(screen.getByText('25%')).toBeOnTheScreen();
    expect(screen.getByText('dashboard.cards.calories.remaining:1500')).toBeOnTheScreen();
  });

  it('zeigt im großen Format Ziel, Fortschritt und positive Restmenge', async () => {
    mockData(2000, 500);
    await renderCard('large');

    expect(screen.getByText('dashboard.cards.calories.today')).toBeOnTheScreen();
    expect(screen.getByText('500')).toBeOnTheScreen();
    expect(screen.getByText('dashboard.cards.calories.remainingLong:1500')).toBeOnTheScreen();
    expect(
      screen.getByText('500/2000:dashboard.cards.calories.ringLabel:percent'),
    ).toBeOnTheScreen();
  });

  it('zeigt im großen Format fehlendes Ziel und überschrittenes Ziel', async () => {
    mockData(null, 400);
    await renderCard('large');
    expect(screen.getByText('dashboard.cards.calories.noGoalSet')).toBeOnTheScreen();

    mockData(100, 500);
    await renderCard('large');
    expect(screen.getByText('dashboard.cards.calories.overGoal:400')).toBeOnTheScreen();
  });
});
