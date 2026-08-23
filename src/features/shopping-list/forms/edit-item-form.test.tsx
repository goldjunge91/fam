import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EditItemForm } from '@/features/shopping-list/forms/edit-item-form';
import type { LocalShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list';

const mockUpdateMutateAsync = jest.fn().mockResolvedValue({});
const mockSetCategoryPreferenceMutateAsync = jest.fn().mockResolvedValue('pref-1');
const mockResetCategoryPreferenceMutateAsync = jest.fn().mockResolvedValue({
  categoryId: null,
  source: null,
  classifierVersion: '1',
});

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

jest.mock('../preferences/hooks', () => ({
  useSetCategoryPreferenceMutation: () => ({
    mutateAsync: mockSetCategoryPreferenceMutateAsync,
  }),
  useResetCategoryPreferenceMutation: () => ({
    mutateAsync: mockResetCategoryPreferenceMutateAsync,
  }),
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
    category_id: 'produce',
    category_source: 'name_fallback',
    category_classifier_version: null,
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

  it('initialisiert die Kategorie aus dem Eintrag, ohne über den Namen neu zu rechnen', async () => {
    await renderForm();

    expect(screen.getByText('Obst & Gemüse')).toBeOnTheScreen();
    expect(screen.getByText('automatisch · Name')).toBeOnTheScreen();
  });

  it('eine Namensänderung berechnet die Kategorie beim Speichern nicht neu', async () => {
    await renderForm();

    await fireEvent.changeText(screen.getByDisplayValue('Bananen'), 'Bio Bananen');
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: 'produce', category_source: 'name_fallback' }),
    );
    expect(mockSetCategoryPreferenceMutateAsync).not.toHaveBeenCalled();
  });

  it('speichert eine Präferenz nur bei einer echten manuellen Kategorieänderung', async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.press(screen.getByRole('button', { name: /Kategorie:/ }));
    await user.press(screen.getByRole('button', { name: 'Getränke' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: 'beverages', category_source: 'user' }),
    );
    expect(mockSetCategoryPreferenceMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: 'hh-1', categoryId: 'beverages' }),
    );
  });

  it('"Automatisch" ruft die Reset-Mutation auf und schreibt beim Speichern keine neue Präferenz', async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.press(screen.getByRole('button', { name: /Kategorie:/ }));
    await user.press(screen.getByRole('button', { name: /^Automatisch/ }));
    expect(mockResetCategoryPreferenceMutateAsync).toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));
    expect(mockSetCategoryPreferenceMutateAsync).not.toHaveBeenCalled();
  });
});
