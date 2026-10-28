import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ComponentType, ReactNode } from 'react';
import type { DashboardCardProps } from '@/features/dashboard/registry';
import '@/features/shopping-list/components/ui/dashboard-card';

let mockGroups: { items: { id: string; checked_at: string | null }[] }[] = [];
let mockShoppingCard: ComponentType<DashboardCardProps> | undefined;

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { accent: '#76566C' } }),
}));
jest.mock('@/components/ui/progress-bar', () => {
  const { createElement } = require('react');
  const { Text: NativeText } = require('react-native');
  return {
    ProgressBar: ({ value }: { value: number }) =>
      createElement(NativeText, null, `progress:${value}`),
  };
});
jest.mock('@/constants/ui', () => {
  const { createElement } = require('react');
  const { Text: NativeText } = require('react-native');
  return {
    Txt: ({ children }: { children: ReactNode }) => createElement(NativeText, null, children),
  };
});
jest.mock('@/features/dashboard/components/dashboard-card-shell', () => ({
  DashboardCardShell: ({ children, ...props }: { children: ReactNode; onPress: () => void }) => {
    const { createElement } = require('react');
    const { Pressable: NativePressable } = require('react-native');
    return createElement(NativePressable, { accessibilityRole: 'button', ...props }, children);
  },
}));
jest.mock('@/features/dashboard/registry', () => ({
  registerCard: (definition: { component: ComponentType<DashboardCardProps> }) => {
    mockShoppingCard = definition.component;
  },
}));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'household-1' }),
}));
jest.mock('@/features/shopping-list/hooks/use-shopping-list', () => ({
  useShoppingList: () => ({ data: mockGroups }),
}));

describe('ShoppingDashboardCard', () => {
  beforeEach(() => {
    mockGroups = [];
    jest.mocked(router.push).mockClear();
  });

  it('shows the large empty state and opens the shopping list', async () => {
    const user = userEvent.setup();
    const Card = mockShoppingCard;
    if (!Card) throw new Error('Shopping dashboard card was not registered');

    await render(<Card size="large" />);

    expect(screen.getByText('dashboard.cards.shopping.empty')).toBeOnTheScreen();
    expect(screen.getByText('dashboard.cards.shopping.done')).toBeOnTheScreen();
    await user.press(screen.getByRole('button'));
    expect(router.push).toHaveBeenCalledWith('/shopping-list');
  });

  it('shows progress and the open state for a partially checked list', async () => {
    mockGroups = [
      {
        items: [
          { id: 'item-1', checked_at: null },
          { id: 'item-2', checked_at: '2026-01-01' },
        ],
      },
    ];
    const Card = mockShoppingCard;
    if (!Card) throw new Error('Shopping dashboard card was not registered');

    await render(<Card size="large" />);

    expect(screen.getByText('progress:0.5')).toBeOnTheScreen();
    expect(screen.getByText('dashboard.cards.shopping.progress')).toBeOnTheScreen();
    expect(screen.getByText('dashboard.cards.shopping.open')).toBeOnTheScreen();
  });

  it('shows done for a small card with no open items', async () => {
    mockGroups = [{ items: [{ id: 'item-1', checked_at: '2026-01-01' }] }];
    const Card = mockShoppingCard;
    if (!Card) throw new Error('Shopping dashboard card was not registered');

    await render(<Card size="small" disabled />);

    expect(screen.getByText('dashboard.cards.shopping.done')).toBeOnTheScreen();
    expect(screen.queryByText(/progress:/)).not.toBeOnTheScreen();
  });
});
