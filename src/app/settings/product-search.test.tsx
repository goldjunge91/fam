import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type React from 'react';

import ProductSearchSettingsRoute from './product-search';

const mockSetPreferredMarket = jest.fn();
let mockHouseholdId: string | undefined = 'household-1';
let mockStores: { id: string; name: string }[] = [];
let mockStoredStoreIds: string[] = [];
let mockStoresLoading = false;
let mockPreferenceLoading = false;

jest.mock('@/components/layout/screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/constants/ui', () => ({
  Press: (props: {
    children: React.ReactNode;
    accessibilityRole: 'button' | 'checkbox';
    accessibilityState?: { checked?: boolean };
    accessibilityLabel?: string;
    disabled?: boolean;
    onPress: () => void;
  }) => {
    const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Pressable {...props} />;
  },
  Txt: ({ children }: { children: React.ReactNode }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({
    activeHousehold: mockHouseholdId ? { id: mockHouseholdId } : null,
  }),
}));

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: () => ({ data: mockStores, isLoading: mockStoresLoading }),
}));

jest.mock('@/features/product-search/preferred-market', () => ({
  usePreferredProductMarket: () => ({ data: mockStoredStoreIds, isLoading: mockPreferenceLoading }),
  useSetPreferredProductMarket: () => mockSetPreferredMarket,
}));

describe('ProductSearchSettingsRoute', () => {
  beforeEach(() => {
    mockSetPreferredMarket.mockReset().mockResolvedValue(undefined);
    mockHouseholdId = 'household-1';
    mockStores = [
      { id: 'store-a', name: 'Markt A' },
      { id: 'store-b', name: 'Markt B' },
      { id: 'store-c', name: 'Markt C' },
    ];
    mockStoredStoreIds = ['store-b', 'store-a', 'deleted-store'];
    mockStoresLoading = false;
    mockPreferenceLoading = false;
  });

  it('shows valid saved preferences first and ignores stores that no longer exist', async () => {
    await render(<ProductSearchSettingsRoute />);

    await waitFor(() => expect(screen.getByText('✓  1. Markt B')).toBeOnTheScreen());
    expect(screen.getByText('✓  2. Markt A')).toBeOnTheScreen();
    expect(screen.getByText('Markt C')).toBeOnTheScreen();
    expect(screen.queryByText(/deleted-store/u)).not.toBeOnTheScreen();
  });

  it('saves a newly selected store and its updated priority order', async () => {
    const user = userEvent.setup();
    await render(<ProductSearchSettingsRoute />);

    await waitFor(() => expect(screen.getByText('✓  1. Markt B')).toBeOnTheScreen());
    await user.press(screen.getByRole('checkbox', { name: 'Markt C auswählen' }));
    await waitFor(() =>
      expect(mockSetPreferredMarket).toHaveBeenLastCalledWith('household-1', [
        'store-b',
        'store-a',
        'store-c',
      ]),
    );

    await user.press(screen.getByRole('button', { name: 'Markt C nach oben bewegen' }));
    await waitFor(() =>
      expect(mockSetPreferredMarket).toHaveBeenLastCalledWith('household-1', [
        'store-b',
        'store-c',
        'store-a',
      ]),
    );
  });

  it('hides the store list while loading and reports when no markets exist', async () => {
    mockStoresLoading = true;
    const loadingScreen = await render(<ProductSearchSettingsRoute />);
    expect(screen.queryByText('Bevorzugte Märkte')).not.toBeOnTheScreen();
    await loadingScreen.unmount();

    mockStoresLoading = false;
    mockStores = [];
    mockStoredStoreIds = [];
    await render(<ProductSearchSettingsRoute />);

    expect(
      screen.getByText('Lege zuerst unter Einstellungen → Märkte einen Markt an.'),
    ).toBeOnTheScreen();
  });

  it('updates selection locally without a household', async () => {
    mockHouseholdId = undefined;
    mockStoredStoreIds = [];
    const user = userEvent.setup();
    await render(<ProductSearchSettingsRoute />);

    await user.press(screen.getByRole('checkbox', { name: 'Markt A auswählen' }));
    expect(screen.getByText('✓  1. Markt A')).toBeOnTheScreen();
    expect(mockSetPreferredMarket).not.toHaveBeenCalled();
  });
});
