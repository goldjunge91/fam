import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ComponentType, ReactNode } from 'react';

import type { DashboardCardProps } from '@/features/dashboard/registry';
import './chef-koch-dashboard-card';

let mockCard: ComponentType<DashboardCardProps> | undefined;
let mockHasAI = true;
let mockHouseholdId: string | null = 'household-1';
let mockItems: Array<{ id: string; name: string; expiry_date: string | null }> = [];

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; name?: string }) =>
      options?.name ? `${key}:${options.name}` : options?.count ? `${key}:${options.count}` : key,
  }),
}));
jest.mock('@/components/icons/fam-icon', () => ({ FamIcon: () => null }));
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { premiumGradientStart: '#715574', premiumOnSurface: '#fff' } }),
}));
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
    mockCard = definition.component;
  },
}));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: mockHouseholdId }),
}));
jest.mock('@/features/inventory/use-inventory-items', () => ({
  useInventoryItems: () => ({ data: mockItems }),
}));
jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ hasAI: mockHasAI }),
}));

function dateAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function renderCard(size: 'small' | 'large', props: Omit<DashboardCardProps, 'size'> = {}) {
  const Card = mockCard;
  if (!Card) throw new Error('Chef-Koch dashboard card was not registered');
  await render(<Card size={size} {...props} />);
}

describe('ChefKochDashboardCard', () => {
  beforeEach(() => {
    mockHasAI = true;
    mockHouseholdId = 'household-1';
    mockItems = [];
    jest.mocked(router.push).mockClear();
  });

  it('opens Chef-Koch and surfaces the most urgent usable item', async () => {
    mockItems = [
      { id: 'spinach', name: 'Spinat', expiry_date: dateAfter(1) },
      { id: 'rice', name: 'Reis', expiry_date: dateAfter(8) },
    ];
    const user = userEvent.setup();
    await renderCard('large');

    expect(screen.getByText('dashboard.cards.chefKoch.title')).toBeOnTheScreen();
    expect(screen.getByText('dashboard.cards.chefKoch.urgent:Spinat')).toBeOnTheScreen();
    await user.press(screen.getByRole('button'));
    expect(router.push).toHaveBeenCalledWith('/chef-koch');
  });

  it('opens Chef-Koch History when the household has no AI entitlement', async () => {
    mockHasAI = false;
    const user = userEvent.setup();
    await renderCard('large');

    expect(screen.getByText('dashboard.cards.chefKoch.locked')).toBeOnTheScreen();
    await user.press(screen.getByRole('button'));
    expect(router.push).toHaveBeenCalledWith('/chef-koch');
  });

  it('disables navigation without an active household', async () => {
    mockHouseholdId = null;
    const user = userEvent.setup();
    await renderCard('small');

    const card = screen.getByRole('button');
    expect(card).toBeDisabled();
    await user.press(card);
    expect(router.push).not.toHaveBeenCalled();
  });
});
