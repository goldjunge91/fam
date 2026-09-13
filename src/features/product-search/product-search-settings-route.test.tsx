import fs from 'node:fs';
import path from 'node:path';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import ProductSearchSettingsRoute from '@/app/settings/product-search';
import type { Store } from '@/features/shopping-list/hooks/use-stores';

const mockSetPreferredMarket = jest.fn();
let mockStores: Store[] = [];
let mockPreferredStoreIds: string[] = [];

jest.mock('@/components/layout/screen', () => {
  const { Text, View } = require('react-native');

  return {
    Screen: ({ children, title }: { children: ReactNode; title?: string }) => (
      <View>
        {title ? <Text>{title}</Text> : null}
        {children}
      </View>
    ),
  };
});

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: { id: 'hh-1' } }),
}));

jest.mock('@/features/product-search/preferred-market', () => ({
  usePreferredProductMarket: () => ({ data: mockPreferredStoreIds, isLoading: false }),
  useSetPreferredProductMarket: () => mockSetPreferredMarket,
}));

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: () => ({ data: mockStores, isLoading: false }),
}));

describe('ProductSearchSettingsRoute', () => {
  beforeEach(() => {
    mockStores = [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'REWE',
        color: '#000000',
        sort_order: 0,
        category_order: null,
      },
      {
        id: 'store-2',
        household_id: 'hh-1',
        name: 'Wochenmarkt',
        color: '#000000',
        sort_order: 1,
        category_order: null,
      },
    ];
    mockPreferredStoreIds = ['store-2', 'store-1'];
    mockSetPreferredMarket.mockReset();
    mockSetPreferredMarket.mockResolvedValue(undefined);
  });

  it('renders the stored market priority and keeps checkbox faces statically styled', async () => {
    await render(<ProductSearchSettingsRoute />);

    expect(await screen.findByText('✓  1. Wochenmarkt')).toBeOnTheScreen();
    const market = screen.getByRole('checkbox', { name: 'Wochenmarkt auswählen' });

    expect(market).toBeChecked();
    expect(market).toHaveStyle({
      backgroundColor: '#FBF7F2',
      borderColor: '#E4DDE3',
      borderRadius: 16,
    });
    expect(screen.getByRole('button', { name: 'Wochenmarkt nach oben bewegen' })).toBeDisabled();
  });

  it('does not use device-unsafe Pressable style callbacks', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../app/settings/product-search.tsx'),
      'utf8',
    );

    expect(source).not.toMatch(/style=\{\(\{\s*pressed/u);
  });

  it('saves a newly selected market in the visible order', async () => {
    mockPreferredStoreIds = [];
    await render(<ProductSearchSettingsRoute />);

    const user = userEvent.setup();
    await user.press(screen.getByRole('checkbox', { name: 'REWE auswählen' }));

    expect(await screen.findByText('✓  1. REWE')).toBeOnTheScreen();
    expect(mockSetPreferredMarket).toHaveBeenLastCalledWith('hh-1', ['store-1']);
  });
});
