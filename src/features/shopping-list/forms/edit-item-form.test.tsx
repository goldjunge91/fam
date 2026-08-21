import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EditItemForm } from '@/features/shopping-list/forms/edit-item-form';
import type { LocalShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list';

const mockUpdateMutateAsync = jest.fn().mockResolvedValue({});

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('../hooks/use-shopping-list-mutations', () => ({
  useUpdateShoppingItem: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

jest.mock('@/features/shopping-list/hooks/use-shopping-list-mutations', () => ({
  useUpdateShoppingItem: () => ({
    mutateAsync: mockUpdateMutateAsync,
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

describe('EditItemForm', () => {
  const mockItem: LocalShoppingItem = {
    id: 'item-1',
    household_id: 'hh-1',
    product_id: null,
    name: 'Bananen',
    quantity: 5,
    unit: 'piece',
    package_size: null,
    package_size_unit: null,
    category: 'Obst & Gemüse',
    store_id: null,
    price_estimate: null,
    recipe_names: [],
    sort_index: 0,
    checked_at: null,
    checked_by: null,
    created_at: '2026-08-20T10:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  };

  async function renderForm() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <QueryClientProvider client={queryClient}>
          <EditItemForm item={mockItem} onDismiss={jest.fn()} />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert den aktuellen Namen des Artikels', async () => {
    await renderForm();

    expect(screen.getByDisplayValue('Bananen')).toBeTruthy();
  });

  it('speichert Änderungen beim Absenden', async () => {
    await renderForm();

    const nameInput = screen.getByDisplayValue('Bananen');
    await fireEvent.changeText(nameInput, 'Bio Bananen');

    const saveBtn = screen.getByRole('button', { name: 'Speichern' });
    await fireEvent.press(saveBtn);

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-1',
        household_id: 'hh-1',
        name: 'Bio Bananen',
      }),
    );
  });
});
