import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EditItemForm } from '@/features/shopping-list/forms/edit-item-form';
import type { LocalShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list';

const mockUpdateMutateAsync = jest.fn().mockResolvedValue({});
const defaultGlobalClassification = {
  placementZoneId: 'fresh_produce',
  productFamilyId: 'fruit',
  productFormId: 'fresh',
  classifierVersion: 'placement-v2.0.0',
};
const mockResolvePlacementForItem = jest.fn().mockResolvedValue({
  ...defaultGlobalClassification,
  categoryId: 'fresh_produce',
  source: 'name_fallback',
  globalClassification: defaultGlobalClassification,
  barcode: null,
});
const mockSetCategoryPreferenceMutateAsync = jest.fn().mockResolvedValue('pref-1');
const mockResetCategoryPreferenceMutateAsync = jest.fn().mockResolvedValue({
  categoryId: null,
  source: null,
  classifierVersion: '1',
});
let mockStores: Array<{
  id: string;
  household_id: string;
  name: string;
  color: string;
  sort_order: number;
  category_order: string | null;
}> = [];

jest.mock('@/components/forms/wheel-picker-field', () => {
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    WheelPickerField: ({
      label,
      options,
      onChange,
    }: {
      label?: string;
      options: readonly { value: string; label: string }[];
      onChange: (value: string) => void;
    }) => (
      <View>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={`${label ?? 'Auswahl'}: ${option.label}`}
            onPress={() => onChange(option.value)}>
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
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
  useStores: () => ({ data: mockStores, isLoading: false }),
  useAddStoreMutation: () => ({ mutateAsync: jest.fn() }),
  findStoreByName: () => null,
}));

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: () => ({ data: mockStores, isLoading: false }),
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

jest.mock('../preferences/api', () => ({
  resolvePlacementForItem: (...args: unknown[]) => mockResolvePlacementForItem(...args),
}));

jest.mock('@/lib/posthog', () => ({
  useFeatureFlag: () => false,
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
    category_id: 'fresh_produce',
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

  async function renderForm(item = mockItem, onDismiss = jest.fn()) {
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
          <EditItemForm item={item} onDismiss={onDismiss} />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockStores = [];
    mockUpdateMutateAsync.mockResolvedValue({});
    mockResolvePlacementForItem.mockResolvedValue({
      ...defaultGlobalClassification,
      categoryId: 'fresh_produce',
      source: 'name_fallback',
      globalClassification: defaultGlobalClassification,
      barcode: null,
    });
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

    await waitFor(() =>
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'item-1',
          household_id: 'hh-1',
          name: 'Bio Bananen',
        }),
      ),
    );
  });

  it('initialisiert die Kategorie aus dem Eintrag, ohne über den Namen neu zu rechnen', async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.press(screen.getByRole('button', { name: 'Weitere Angaben' }));

    expect(screen.getByText('Obst & Gemüse')).toBeOnTheScreen();
    expect(screen.queryByText('automatisch · Name')).not.toBeOnTheScreen();
  });

  it('eine Namensänderung berechnet die Kategorie beim Speichern nicht neu', async () => {
    await renderForm();

    await fireEvent.changeText(screen.getByDisplayValue('Bananen'), 'Bio Bananen');
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ category_id: 'fresh_produce', category_source: 'name_fallback' }),
      ),
    );
    expect(mockSetCategoryPreferenceMutateAsync).not.toHaveBeenCalled();
  });

  it('speichert eine Präferenz nur bei einer echten manuellen Kategorieänderung', async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Wasser, Saft & Softdrinks' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ category_id: 'cold_drinks', category_source: 'user' }),
      ),
    );
    await waitFor(() =>
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          preference: expect.objectContaining({
            type: 'set',
            input: expect.objectContaining({ householdId: 'hh-1', categoryId: 'cold_drinks' }),
          }),
        }),
      ),
    );
  });

  it('ordnet eine manuelle Auswahl nach einem Marktwechsel nur dem neuen Markt zu', async () => {
    mockStores = [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Alter Markt',
        color: '#8B5E83',
        sort_order: 0,
        category_order: null,
      },
      {
        id: 'store-2',
        household_id: 'hh-1',
        name: 'Neuer Markt',
        color: '#A46A5A',
        sort_order: 1,
        category_order: null,
      },
    ];
    const user = userEvent.setup();
    await renderForm({
      ...mockItem,
      store_id: 'store-1',
      category_source: 'store_preference',
    });

    await user.press(screen.getByRole('button', { name: 'Markt: Neuer Markt' }));
    await user.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Wasser, Saft & Softdrinks' }));
    await user.press(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: 'store-2',
          category_id: 'cold_drinks',
          preference: expect.objectContaining({
            type: 'set',
            input: expect.objectContaining({ storeId: 'store-2', categoryId: 'cold_drinks' }),
          }),
        }),
      ),
    );
    expect(mockSetCategoryPreferenceMutateAsync).not.toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 'store-1' }),
    );
  });

  it('"Automatisch" ruft Reset erst beim Speichern auf', async () => {
    const user = userEvent.setup();
    await renderForm({
      ...mockItem,
      store_id: 'store-1',
      category_source: 'household_preference',
    });

    await user.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: /^Automatisch/ }));
    expect(mockResetCategoryPreferenceMutateAsync).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(mockResolvePlacementForItem).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: 'store-1' }),
        { omitPreferenceScope: 'household' },
      ),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          preference: expect.objectContaining({
            type: 'reset',
            input: expect.objectContaining({ storeId: null }),
          }),
        }),
      ),
    );
  });

  it('schliesst nur nach erfolgreichem lokalen Save', async () => {
    const onDismiss = jest.fn();
    mockUpdateMutateAsync.mockRejectedValueOnce(new Error('SQLite write failed'));
    await renderForm(mockItem, onDismiss);

    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    expect(
      await screen.findByText('Speichern fehlgeschlagen. Bitte erneut versuchen.'),
    ).toBeOnTheScreen();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
