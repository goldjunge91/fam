import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ComponentType, ReactNode } from 'react';
import type { DashboardCardProps } from '@/features/dashboard/registry';
import '@/features/inventory/components/dashboard-card';

let mockItems: { id: string; name: string; expiry_date: string | null }[] = [];
let mockInventoryCard: ComponentType<DashboardCardProps> | undefined;

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { warning: '#a55' } }),
}));
jest.mock('@/components/theme/index', () => ({
  radius: { md: 8 },
  space: { sm: 4, md: 8, xs: 2 },
  withAlpha: (color: string) => color,
}));
jest.mock('@/constants/ui', () => {
  const React = require('react') as typeof import('react');
  const { Text } = require('react-native') as typeof import('react-native');
  return {
    Txt: ({ children, ...props }: { children: ReactNode }) =>
      React.createElement(Text, props, children),
  };
});
jest.mock('@/features/dashboard/components/dashboard-card-shell', () => {
  const React = require('react') as typeof import('react');
  const { Pressable } = require('react-native') as typeof import('react-native');
  return {
    DashboardCardShell: ({ children, ...props }: { children: ReactNode; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityRole: 'button', ...props }, children),
  };
});
jest.mock('@/features/dashboard/registry', () => ({
  registerCard: (definition: { component: ComponentType<DashboardCardProps> }) => {
    mockInventoryCard = definition.component;
  },
}));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'household-1' }),
}));
jest.mock('@/features/inventory/use-inventory-items', () => ({
  useInventoryItems: () => ({ data: mockItems }),
}));

function dateAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function renderCard(size: 'small' | 'large', props: Omit<DashboardCardProps, 'size'> = {}) {
  const Card = mockInventoryCard;
  if (!Card) throw new Error('Inventory dashboard card was not registered');
  return render(<Card size={size} {...props} />);
}

describe('InventoryDashboardCard', () => {
  beforeEach(() => {
    mockItems = [];
    jest.mocked(router.push).mockClear();
  });

  it('zeigt den leeren Großzustand und öffnet den Bestandsfilter', async () => {
    const user = userEvent.setup();
    await renderCard('large');

    expect(screen.getByText('dashboard.cards.inventory.empty')).toBeOnTheScreen();
    expect(screen.getByText('0')).toBeOnTheScreen();
    await user.press(screen.getByRole('button'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/fridge',
      params: { filter: 'expiring' },
    });
  });

  it('zeigt nur kritische, abgelaufene und innerhalb von drei Tagen fällige Artikel', async () => {
    mockItems = [
      { id: 'expired', name: 'Abgelaufen', expiry_date: dateAfter(-1) },
      { id: 'tomorrow', name: 'Morgen', expiry_date: dateAfter(1) },
      { id: 'soon', name: 'Bald', expiry_date: dateAfter(3) },
      { id: 'later', name: 'Später', expiry_date: dateAfter(8) },
      { id: 'unknown', name: 'Ohne Datum', expiry_date: null },
    ];
    await renderCard('large');

    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('Abgelaufen')).toBeOnTheScreen();
    expect(screen.getByText('dashboard.cards.inventory.overdue')).toBeOnTheScreen();
    expect(screen.getByText('dashboard.cards.inventory.tomorrow')).toBeOnTheScreen();
    expect(screen.getByText('dashboard.cards.inventory.daysRemaining')).toBeOnTheScreen();
    expect(screen.queryByText('Später')).not.toBeOnTheScreen();
    expect(screen.queryByText('Ohne Datum')).not.toBeOnTheScreen();
  });

  it('zeigt einen heute ablaufenden Artikel mit dem heutigen Status', async () => {
    mockItems = [{ id: 'today', name: 'Heute', expiry_date: dateAfter(0) }];
    await renderCard('large');

    expect(screen.getByText('dashboard.cards.inventory.today')).toBeOnTheScreen();
  });

  it('zeigt im kleinen Format die Anzahl und reicht Long-Press und disabled weiter', async () => {
    mockItems = [
      { id: 'one', name: 'Milch', expiry_date: dateAfter(2) },
      { id: 'two', name: 'Brot', expiry_date: dateAfter(9) },
    ];
    const user = userEvent.setup();
    const onLongPress = jest.fn();
    await renderCard('small', { onLongPress });

    expect(screen.getByText('1')).toBeOnTheScreen();
    await user.longPress(screen.getByRole('button'));
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});
