import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AddItemForm } from '@/features/shopping-list/forms/add-item-form';

const mockAddMutateAsync = jest.fn().mockResolvedValue({});

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('../hooks/use-shopping-list-mutations', () => ({
  useAddShoppingItem: () => ({
    mutateAsync: mockAddMutateAsync,
    isPending: false,
  }),
}));

jest.mock('@/features/shopping-list/hooks/use-shopping-list-mutations', () => ({
  useAddShoppingItem: () => ({
    mutateAsync: mockAddMutateAsync,
    isPending: false,
  }),
}));

jest.mock('../hooks/use-stores', () => ({
  useStores: () => ({ data: [], isLoading: false }),
  useAddStoreMutation: () => ({ mutateAsync: jest.fn() }),
  findStoreByName: () => null,
}));

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: () => ({ data: [], isLoading: false }),
  useAddStoreMutation: () => ({ mutateAsync: jest.fn() }),
  findStoreByName: () => null,
}));

describe('AddItemForm', () => {
  async function renderForm() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <QueryClientProvider client={queryClient}>
          <AddItemForm householdId="hh-1" onDismiss={jest.fn()} />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert die Formular-Felder für Suche, Menge und Buttons', async () => {
    await renderForm();

    expect(screen.getByPlaceholderText('Artikel suchen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' })).toBeTruthy();
  });

  it('übermittelt den neuen Artikel bei korrekter Eingabe', async () => {
    await renderForm();

    const input = screen.getByPlaceholderText('Artikel suchen');
    await fireEvent.changeText(input, 'Hafermilch');

    const addBtn = screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' });
    await fireEvent.press(addBtn);

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: 'hh-1',
        name: 'Hafermilch',
      }),
    );
  });
});
