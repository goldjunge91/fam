import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StorePickerMenu } from '@/features/shopping-list/components/ui/store-picker-menu';
import { StorePickerField } from '@/features/shopping-list/forms/store-picker-field';
import type { Store } from '@/features/shopping-list/hooks/use-stores';

jest.mock('expo-glass-effect', () => ({
  isGlassEffectAPIAvailable: () => false,
  isLiquidGlassAvailable: () => false,
  GlassView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: () => ({
    data: [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Rewe',
        color: '#E53E3E',
        sort_order: 0,
        category_order: null,
      },
      {
        id: 'store-2',
        household_id: 'hh-1',
        name: 'Aldi',
        color: '#3182CE',
        sort_order: 1,
        category_order: null,
      },
    ],
    isLoading: false,
  }),
  useAddStoreMutation: () => ({ mutateAsync: jest.fn() }),
  findStoreByName: () => null,
}));

describe('StorePicker Components', () => {
  const mockStores: Store[] = [
    {
      id: 'store-1',
      household_id: 'hh-1',
      name: 'Rewe',
      color: '#E53E3E',
      sort_order: 0,
      category_order: null,
    },
    {
      id: 'store-2',
      household_id: 'hh-1',
      name: 'Aldi',
      color: '#3182CE',
      sort_order: 1,
      category_order: null,
    },
  ];

  function wrapper({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return (
      // Ohne initialMetrics rendert SafeAreaProvider seine Children nicht,
      // solange kein natives Layout-Event eintrifft — passiert in Tests nie.
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  describe('StorePickerMenu', () => {
    it('rendert den aktiven Filter-Button', async () => {
      const onFilterChange = jest.fn();
      await render(
        <StorePickerMenu
          activeFilter="all"
          onFilterChange={onFilterChange}
          stores={mockStores}
          totalCount={5}
          unassignedCount={2}
          countForStore={(id) => (id === 'store-1' ? 3 : 0)}
        />,
        { wrapper },
      );

      expect(screen.getByText('Alle Listen')).toBeTruthy();
    });
  });

  describe('StorePickerField', () => {
    it('rendert die Auswahloptionen für das Formular', async () => {
      const onChange = jest.fn();
      await render(<StorePickerField householdId="hh-1" storeId="store-1" onChange={onChange} />, {
        wrapper,
      });

      expect(screen.getByText('Rewe')).toBeTruthy();
    });
  });
});
