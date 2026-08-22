import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ShoppingListScreen } from './shopping-list-screen';

let mockParams: { action?: string } = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

const mockToggleMutateAsync = jest.fn();
const mockDeleteMutateAsync = jest.fn();

jest.mock('../hooks/use-shopping-list-mutations', () => ({
  useToggleShoppingItem: () => ({ mutateAsync: mockToggleMutateAsync }),
  useDeleteShoppingItem: () => ({ mutateAsync: mockDeleteMutateAsync }),
  useCompleteShoppingRun: () => ({ mutateAsync: jest.fn() }),
  useAddShoppingItem: () => ({ mutateAsync: jest.fn() }),
  // Zeile antippen oeffnet jetzt das Bearbeiten-Formular (statt abzuhaken),
  // das braucht diesen Hook.
  useUpdateShoppingItem: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('../hooks/use-shopping-list', () => {
  const actual = jest.requireActual('../hooks/use-shopping-list');
  return {
    ...actual,
    useShoppingList: () => ({
      data: [
        {
          category: 'Obst & Gemüse',
          items: [
            {
              id: 'item-1',
              household_id: 'hh-1',
              name: 'Bananen',
              quantity: 3,
              unit: 'Stk',
              category_id: 'produce',
              category_source: 'name_fallback',
              category_classifier_version: null,
              category: 'Obst & Gemüse',
              checked_at: null,
              checked_by: null,
              store_id: 'store-1',
              notes: null,
              recipe_names: [],
              sort_order: 0,
              product_id: null,
              updated_at: '2026-03-29T10:00:00Z',
            },
          ],
        },
      ],
      isLoading: false,
    }),
  };
});

jest.mock('../hooks/use-stores', () => {
  const actual = jest.requireActual('../hooks/use-stores');
  return {
    ...actual,
    useStores: () => ({
      data: [
        {
          id: 'store-1',
          name: 'Supermarkt',
          color: '#ff5500',
          icon: 'cart',
          household_id: 'hh-1',
        },
      ],
    }),
    useSetStoreCategoryOrderMutation: () => ({
      mutateAsync: jest.fn(),
      isPending: false,
    }),
  };
});

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openDrawer: jest.fn(), openProfile: jest.fn() }),
}));

jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileInitials: () => 'M',
}));

jest.mock('@/hooks/use-hub-gradient', () => ({
  useHubGradient: () => undefined,
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
}));

describe('ShoppingListScreen', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  beforeEach(() => {
    mockParams = {};
    jest.clearAllMocks();
  });

  async function renderScreen() {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <QueryClientProvider client={queryClient}>
          <ShoppingListScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  it('rendert Markt-Übersicht in der Gesamtansicht', async () => {
    await renderScreen();

    expect(screen.getByText('Supermarkt')).toBeTruthy();
  });

  it('hakt Artikel in der Marktliste nicht mehr per Antippen ab — das passiert nur im Einkaufsmodus', async () => {
    await renderScreen();

    const storeCard = screen.getByText('Supermarkt');
    fireEvent.press(storeCard);

    await waitFor(() => {
      expect(screen.getByText('Bananen')).toBeTruthy();
    });

    // Antippen der Zeile oeffnet jetzt das Bearbeiten-Formular statt abzuhaken.
    const row = screen.getByRole('button', { name: 'Bananen bearbeiten' });
    fireEvent.press(row);

    expect(mockToggleMutateAsync).not.toHaveBeenCalled();
  });

  it('öffnet das AddItemModal beim Klick auf Artikel hinzufügen', async () => {
    await renderScreen();

    const addBtn = screen.getByRole('button', { name: '+ Artikel hinzufügen' });
    fireEvent.press(addBtn);

    await waitFor(() => {
      expect(screen.getAllByText('Artikel hinzufügen').length).toBeGreaterThan(0);
    });
  });

  it('öffnet das AddItemModal automatisch, wenn action=add gesetzt ist', async () => {
    mockParams = { action: 'add' };
    await renderScreen();

    await waitFor(() => {
      expect(screen.getAllByText('Artikel hinzufügen').length).toBeGreaterThan(0);
    });
  });
});
