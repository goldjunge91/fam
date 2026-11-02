import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';
import type React from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StorePickerMenu } from '@/features/shopping-list/components/ui/store-picker-menu';
import { StorePickerField } from '@/features/shopping-list/forms/store-picker-field';
import type { Store } from '@/features/shopping-list/hooks/use-stores';
import { i18n } from '@/i18n';

const mockAddStoreMutateAsync = jest.fn();
const mockFindStoreByName = jest.fn();
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

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Native = jest.requireActual<typeof import('react-native')>('react-native');
  const View = React.forwardRef<
    {
      measureInWindow: (
        callback: (x: number, y: number, width: number, height: number) => void,
      ) => void;
    },
    React.ComponentProps<typeof Native.View>
  >((props, ref) => {
    React.useImperativeHandle(
      ref,
      () => ({
        measureInWindow: (callback) => callback(12, 24, 200, 44),
      }),
      [],
    );
    return React.createElement(Native.View, props);
  });
  return new Proxy(
    {},
    {
      get: (_target, key: keyof typeof Native) => (key === 'View' ? View : Native[key]),
    },
  );
});

jest.mock('expo-glass-effect', () => ({
  isGlassEffectAPIAvailable: () => false,
  isLiquidGlassAvailable: () => false,
  GlassView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
  useOptionalActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: () => ({ data: mockStores, isLoading: false }),
  useAddStoreMutation: () => ({ mutateAsync: mockAddStoreMutateAsync }),
  findStoreByName: (...args: unknown[]) => mockFindStoreByName(...args),
}));

describe('StorePicker Components', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockAddStoreMutateAsync.mockReset();
    mockFindStoreByName.mockReset().mockReturnValue(null);
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
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

    it.each([
      ['unassigned', 'Ohne Markt'],
      ['store-1', 'Rewe'],
      ['missing-store', 'Alle Listen'],
    ])('shows the correct label for filter %s', async (activeFilter, label) => {
      await render(
        <StorePickerMenu
          activeFilter={activeFilter}
          onFilterChange={jest.fn()}
          stores={mockStores}
          totalCount={5}
          unassignedCount={2}
          countForStore={() => 0}
        />,
        { wrapper },
      );

      expect(screen.getByText(label)).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: `Markt filtern, aktuell: ${label}` }),
      ).toBeOnTheScreen();
    });

    it('öffnet das Menü, zeigt Markt-Zähler und schließt nach Auswahl', async () => {
      const user = userEvent.setup();
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

      await user.press(screen.getByRole('button', { name: 'Markt filtern, aktuell: Alle Listen' }));
      expect(screen.getByText('Rewe')).toBeOnTheScreen();
      expect(screen.getByText('3')).toBeOnTheScreen();
      await user.press(screen.getByText('Rewe'));

      expect(onFilterChange).toHaveBeenCalledWith('store-1');
      expect(screen.queryByText('Rewe')).not.toBeOnTheScreen();
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

    it('meldet eine ausgewählte Marktoption über die zugängliche Radio-Fläche', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await render(<StorePickerField householdId="hh-1" storeId={null} onChange={onChange} />, {
        wrapper,
      });

      expect(screen.getByRole('radio', { name: 'Ohne Markt' })).toBeSelected();
      await user.press(screen.getByRole('radio', { name: 'Rewe' }));

      expect(onChange).toHaveBeenCalledWith('store-1');
    });

    it('erstellt einen neuen Markt aus einem Preset und weist ihn direkt zu', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      mockAddStoreMutateAsync.mockResolvedValue({ id: 'store-new' });
      await render(<StorePickerField householdId="hh-1" storeId={null} onChange={onChange} />, {
        wrapper,
      });

      await user.press(screen.getByRole('button', { name: 'Neuer Markt' }));
      const input = screen.getByPlaceholderText('z.B. REWE');
      await user.type(input, ' Mein Markt ');
      await user.press(screen.getByRole('button', { name: 'REWE' }));
      await user.press(screen.getByRole('button', { name: 'Erstellen' }));

      expect(mockAddStoreMutateAsync).toHaveBeenCalledWith({
        household_id: 'hh-1',
        name: 'REWE',
        color: expect.any(String),
      });
      expect(onChange).toHaveBeenCalledWith('store-new');
      expect(screen.queryByPlaceholderText('z.B. REWE')).not.toBeOnTheScreen();
    });

    it('waehlt einen vorhandenen gleichnamigen Markt statt ihn neu anzulegen', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      mockFindStoreByName.mockReturnValue(mockStores[0]);
      await render(<StorePickerField householdId="hh-1" storeId={null} onChange={onChange} />, {
        wrapper,
      });

      await user.press(screen.getByRole('button', { name: 'Neuer Markt' }));
      await user.type(screen.getByPlaceholderText('z.B. REWE'), 'Rewe');
      await user.press(screen.getByRole('button', { name: 'Erstellen' }));

      expect(onChange).toHaveBeenCalledWith('store-1');
      expect(mockAddStoreMutateAsync).not.toHaveBeenCalled();
    });

    it('zeigt einen Hinweis, wenn ein gleichnamiger Markt eine andere Farbe hat', async () => {
      const user = userEvent.setup();
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      mockFindStoreByName.mockReturnValue(mockStores[0]);
      await render(<StorePickerField householdId="hh-1" storeId={null} onChange={jest.fn()} />, {
        wrapper,
      });

      await user.press(screen.getByRole('button', { name: 'Neuer Markt' }));
      await user.type(screen.getByPlaceholderText('z.B. REWE'), 'Rewe');
      await user.press(screen.getByRole('button', { name: 'Erstellen' }));

      expect(alertSpy).toHaveBeenCalledWith(
        'Markt existiert bereits',
        '"Rewe" gibt es schon in einer anderen Farbe. Der vorhandene Markt wird verwendet.',
      );
      alertSpy.mockRestore();
    });
  });
});
