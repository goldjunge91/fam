import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { UseProductSearchResult } from '@/features/product-search/hooks/use-product-search';
import type { CatalogProduct } from '@/features/product-search/types';
import { AddItemForm } from '@/features/shopping-list/forms/add-item-form';
import type { ShoppingProductSuggestion } from '@/features/shopping-list/hooks/use-shopping-product-suggestions';
import { i18n } from '@/i18n';

const mockAddMutateAsync = jest.fn().mockResolvedValue({});
const mockGetFirstAsync = jest.fn().mockResolvedValue(null);
const mockBarcodeReset = jest.fn();
const mockBarcodeLookup = jest.fn();
const mockUseProductSearch = jest.fn();
const mockUseShoppingProductSuggestions = jest.fn();
const mockProductSearchState: UseProductSearchResult = {
  results: [],
  searching: false,
  loadingMore: false,
  failed: false,
  hasMore: false,
  searched: false,
  loadMore: jest.fn(),
  searchOnline: jest.fn(),
  retry: jest.fn(),
};
let mockSuggestionRows: ShoppingProductSuggestion[] = [];
let mockStores: { id: string; name: string; category_order: string | null }[] = [];
let mockScannedProduct: CatalogProduct = {
  barcode: '4001234567890',
  name: 'Gescannter Haferdrink',
  quantity: 1,
  unit: 'l',
  categoryTags: [],
};
const defaultGlobalClassification = {
  placementZoneId: 'other',
  productFamilyId: 'other_food',
  productFormId: 'ambient',
  classifierVersion: 'placement-v2.0.0',
};
const mockResolvePlacementForItem = jest.fn().mockResolvedValue({
  ...defaultGlobalClassification,
  categoryId: 'other',
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
let mockFeedbackEnabled = false;
let mockUserId: string | null = null;

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({
    session: mockUserId ? { user: { id: mockUserId } } : null,
    isLoading: false,
    seenOnboarding: true,
    error: null,
  }),
}));

jest.mock('@/lib/observability/providers/posthog', () => ({
  useFeatureFlag: () => mockFeedbackEnabled,
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
  useOptionalActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
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

jest.mock('@/features/product-search/hooks/use-product-barcode-lookup', () => ({
  useProductBarcodeLookup: ({ onFound }: { onFound: (product: CatalogProduct) => void }) => ({
    lookup: (barcode: string) => {
      mockBarcodeLookup(barcode);
      onFound(mockScannedProduct);
    },
    reset: mockBarcodeReset,
    looking: false,
    errorMessage: null,
  }),
}));

jest.mock('@/features/inventory/barcode-scanner-modal', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    BarcodeScannerModal: ({
      visible,
      onClose,
      onBarcodeDetected,
    }: {
      visible: boolean;
      onClose: () => void;
      onBarcodeDetected: (barcode: string) => void;
    }) =>
      visible ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Testbarcode erkennen"
            onPress={() => onBarcodeDetected('4001234567890')}>
            <Text>Testbarcode erkennen</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scanner schließen"
            onPress={onClose}>
            <Text>Scanner schließen</Text>
          </Pressable>
        </>
      ) : null,
  };
});

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
            key={`${label ?? 'Auswahl'}-${option.value}`}
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

jest.mock('@/features/product-search/hooks/use-product-search', () => ({
  useProductSearch: (...args: unknown[]) => mockUseProductSearch(...args),
}));

jest.mock('@/features/product-search/preferred-market', () => ({
  usePreferredProductMarketName: () => null,
}));

jest.mock('../hooks/use-shopping-product-suggestions', () => ({
  useShoppingProductSuggestions: (...args: unknown[]) => mockUseShoppingProductSuggestions(...args),
}));

jest.mock('@/lib/db/product-usage', () => ({ recordProductUsage: jest.fn() }));

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

jest.mock('../preferences/api', () => ({
  resolvePlacementForItem: (...args: unknown[]) => mockResolvePlacementForItem(...args),
}));

// Isoliert die (nicht abgefangene, laenger als der Test dauernde) debounced
// Live-Suche von `ProductSearchDropdown` — ohne diesen Mock crasht ihr
// `getDatabase()`-Aufruf mit "NativeDatabase is not a constructor" und
// leakt in ein spaeteres Test-Timing-Fenster (nicht Teil dieses Formulars,
// nichts, was #223 Paket 8 hier aendert).
jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
    runAsync: jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 }),
    execAsync: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('../preferences/hooks', () => ({
  useSetCategoryPreferenceMutation: () => ({
    mutateAsync: mockSetCategoryPreferenceMutateAsync,
  }),
  useResetCategoryPreferenceMutation: () => ({
    mutateAsync: mockResetCategoryPreferenceMutateAsync,
  }),
}));

describe('AddItemForm', () => {
  async function renderForm(
    onDismiss = jest.fn(),
    options: {
      initialProduct?: CatalogProduct | null;
      initialStoreId?: string | null;
      onItemAdded?: () => void;
    } = {},
  ) {
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
          <AddItemForm
            householdId="hh-1"
            initialProduct={options.initialProduct}
            initialStoreId={options.initialStoreId}
            onDismiss={onDismiss}
            onItemAdded={options.onItemAdded}
          />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('de');
    mockFeedbackEnabled = false;
    mockUserId = null;
    mockSuggestionRows = [];
    mockStores = [];
    mockScannedProduct = {
      barcode: '4001234567890',
      name: 'Gescannter Haferdrink',
      quantity: 1,
      unit: 'l',
      categoryTags: [],
    };
    mockGetFirstAsync.mockResolvedValue(null);
    mockBarcodeReset.mockClear();
    mockBarcodeLookup.mockClear();
    mockUseProductSearch.mockReturnValue(mockProductSearchState);
    mockUseShoppingProductSuggestions.mockImplementation(() => ({ data: mockSuggestionRows }));
    mockAddMutateAsync.mockResolvedValue({});
    mockResolvePlacementForItem.mockResolvedValue({
      ...defaultGlobalClassification,
      categoryId: 'other',
      source: 'name_fallback',
      globalClassification: defaultGlobalClassification,
      barcode: null,
    });
  });

  it('rendert die Formular-Felder für Suche, Menge und Buttons', async () => {
    await renderForm();

    expect(screen.getByPlaceholderText('Artikel suchen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' })).toBeTruthy();
  });

  it('stellt Weitere Angaben als zugängliches 44-Punkt-Ziel bereit', async () => {
    const user = userEvent.setup();
    await renderForm();

    const toggle = screen.getByRole('button', { name: 'Weitere Angaben' });
    expect(toggle).toBeCollapsed();
    expect(toggle).toHaveStyle({ minHeight: 44 });

    await user.press(toggle);

    expect(screen.getByRole('button', { name: 'Weitere Angaben' })).toBeExpanded();
  });

  it('übermittelt den neuen Artikel bei korrekter Eingabe', async () => {
    await renderForm();

    const input = screen.getByPlaceholderText('Artikel suchen');
    await fireEvent.changeText(input, 'Hafermilch');
    await waitFor(() => expect(mockResolvePlacementForItem).toHaveBeenCalled());

    const addBtn = screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' });
    await fireEvent.press(addBtn);

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: 'hh-1',
        name: 'Hafermilch',
      }),
    );
  });

  it('übernimmt ein bekanntes Produkt mit Packungsinhalt und Preis', async () => {
    const onItemAdded = jest.fn();
    const product: CatalogProduct = {
      productId: 'product-milk',
      barcode: '4001234567890',
      name: 'Haferdrink',
      brand: 'Biohof',
      quantity: 1,
      unit: 'l',
      categoryTags: ['plant_milk'],
    };
    await renderForm(jest.fn(), { initialProduct: product, onItemAdded });

    await waitFor(() => expect(screen.getByDisplayValue('Haferdrink')).toBeOnTheScreen());
    expect(screen.getByText('Biohof')).toBeOnTheScreen();
    expect(screen.getByText('EAN 4001234567890')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await fireEvent.changeText(screen.getByPlaceholderText('z. B. 500'), '1,5');
    await fireEvent.changeText(screen.getByPlaceholderText('z. B. 2,49 €'), '2,49');
    await fireEvent.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'product-milk',
        package_size: 1.5,
        package_size_unit: 'l',
        price_estimate: 2.49,
      }),
    );
    expect(onItemAdded).toHaveBeenCalledTimes(1);
  });

  it('lässt bei Produkten ohne Messpackung die Packungsangaben leer', async () => {
    const product: CatalogProduct = {
      barcode: '4001234567891',
      name: 'Eier',
      quantity: 1,
      unit: 'piece',
      categoryTags: ['eggs'],
    };
    await renderForm(jest.fn(), { initialProduct: product });

    await waitFor(() => expect(screen.getByDisplayValue('Eier')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: null, package_size: null, package_size_unit: null }),
    );
  });

  it('übernimmt einen Suchtreffer samt zuletzt verwendetem Markt', async () => {
    const user = userEvent.setup();
    const product: CatalogProduct = {
      productId: 'product-oat-drink',
      barcode: '4001234567892',
      name: 'Haferdrink Barista',
      brand: 'Oatly',
      quantity: 1.5,
      unit: 'l',
      categoryTags: ['plant_milk'],
    };
    mockStores = [{ id: 'store-1', name: 'Rewe', category_order: null }];
    mockGetFirstAsync.mockResolvedValueOnce({ store_id: 'store-1' });
    mockUseProductSearch.mockImplementation((query: string) => ({
      ...mockProductSearchState,
      results: query.length >= 2 ? [product] : [],
      searched: query.length >= 2,
    }));
    await renderForm();

    await user.type(screen.getByPlaceholderText('Artikel suchen'), 'Haferdrink');
    await user.press(await screen.findByRole('button', { name: product.name }));
    await user.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'product-oat-drink',
        store_id: 'store-1',
        package_size: 1.5,
        package_size_unit: 'l',
      }),
    );
  });

  it('übernimmt einen Verlaufsvorschlag mit Markt und wechselt den Vorschlagsfilter', async () => {
    const user = userEvent.setup();
    mockUserId = 'user-1';
    mockStores = [{ id: 'store-1', name: 'Rewe', category_order: null }];
    mockSuggestionRows = [
      {
        name: 'Haferdrink aus Verlauf',
        brand: 'Biohof',
        barcode: null,
        product_id: 'product-history-1',
        unit: 'l',
        quantity: 1,
        last_store_id: 'store-1',
        last_store_name: 'Rewe',
      },
    ];
    await renderForm();

    await user.press(screen.getByRole('button', { name: 'Vorschlagsfilter' }));
    await user.press(screen.getByRole('menuitem', { name: /Häufig/ }));
    await waitFor(() =>
      expect(mockUseShoppingProductSuggestions).toHaveBeenLastCalledWith(
        expect.objectContaining({ mode: 'frequent' }),
      ),
    );

    await user.press(screen.getByRole('button', { name: /Haferdrink aus Verlauf/ }));
    await user.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'product-history-1',
        store_id: 'store-1',
        package_size: 1,
        package_size_unit: 'l',
      }),
    );
  });

  it('speichert Änderungen an Menge, Markt, Packungsinhalt und Packungseinheit', async () => {
    const user = userEvent.setup();
    mockStores = [{ id: 'store-1', name: 'Rewe', category_order: null }];
    await renderForm();

    await user.type(screen.getByPlaceholderText('Artikel suchen'), 'Kaffee');
    await user.press(screen.getByRole('button', { name: 'Einkaufsmenge erhöhen' }));
    await user.press(screen.getByRole('button', { name: 'Markt: Rewe' }));
    await user.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await user.press(screen.getByRole('button', { name: 'Einheit: Packung' }));
    await user.type(screen.getByPlaceholderText('z. B. 500'), '500');
    const packageUnitChoices = screen.getAllByRole('button', {
      name: 'Einheit: Milliliter (ml)',
    });
    const packageUnitChoice = packageUnitChoices[1];
    if (!packageUnitChoice) throw new Error('Packungseinheit fehlt');
    await user.press(packageUnitChoice);
    await user.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 2,
        unit: 'package',
        store_id: 'store-1',
        package_size: 500,
        package_size_unit: 'ml',
      }),
    );
  });

  it('setzt den Barcode-Scanner zurück und übernimmt ein erkanntes Produkt', async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.press(screen.getByRole('button', { name: 'Barcode scannen' }));
    await user.press(screen.getByRole('button', { name: 'Scanner schließen' }));
    expect(mockBarcodeReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Scanner schließen' })).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Barcode scannen' }));
    await user.press(screen.getByRole('button', { name: 'Testbarcode erkennen' }));

    expect(mockBarcodeLookup).toHaveBeenCalledWith('4001234567890');
    expect(screen.getByDisplayValue('Gescannter Haferdrink')).toBeOnTheScreen();
  });

  it('zeigt die automatisch aufgelöste Kategorie im Kategoriefeld an', async () => {
    mockResolvePlacementForItem.mockResolvedValueOnce({
      ...defaultGlobalClassification,
      placementZoneId: 'meat_poultry',
      categoryId: 'meat_poultry',
      source: 'name_fallback',
      globalClassification: {
        ...defaultGlobalClassification,
        placementZoneId: 'meat_poultry',
      },
      barcode: null,
    });
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Schnitzel');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));

    expect(await screen.findByText('Fleisch & Geflügel')).toBeOnTheScreen();
    expect(screen.queryByText('automatisch · Name')).not.toBeOnTheScreen();
  });

  it('eine manuelle Kategorie bleibt bei einer Namensänderung erhalten', async () => {
    const user = userEvent.setup();
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Testartikel');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await waitFor(() => expect(mockResolvePlacementForItem).toHaveBeenCalled());

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Wasser, Saft & Softdrinks' }));
    expect(screen.getByText('Wasser, Saft & Softdrinks')).toBeOnTheScreen();

    mockResolvePlacementForItem.mockClear();
    await fireEvent.changeText(
      screen.getByPlaceholderText('Artikel suchen'),
      'Testartikel geändert',
    );

    expect(mockResolvePlacementForItem).not.toHaveBeenCalled();
    expect(screen.getByText('Wasser, Saft & Softdrinks')).toBeOnTheScreen();
  });

  it('bewusstes "Sonstiges" bleibt bei einer Namensänderung bestehen', async () => {
    const user = userEvent.setup();
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Grillkohle');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await waitFor(() => expect(mockResolvePlacementForItem).toHaveBeenCalled());

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    const otherOptions = screen.getAllByRole('button', { name: 'Sonstiges' });
    const otherOption = otherOptions[otherOptions.length - 1];
    if (!otherOption) throw new Error('Sonstiges option is missing');
    await user.press(otherOption);
    expect(screen.getByText('Sonstiges')).toBeOnTheScreen();

    mockResolvePlacementForItem.mockClear();
    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Grillkohle Menge 5');

    expect(mockResolvePlacementForItem).not.toHaveBeenCalled();
    expect(screen.getByText('Sonstiges')).toBeOnTheScreen();
  });

  it('"Automatisch" bleibt bis zum Speichern ohne Präferenzmutation', async () => {
    const user = userEvent.setup();
    mockResolvePlacementForItem.mockResolvedValueOnce({
      ...defaultGlobalClassification,
      placementZoneId: 'chilled_dairy_eggs',
      categoryId: 'chilled_dairy_eggs',
      source: 'household_preference',
      globalClassification: defaultGlobalClassification,
      barcode: null,
    });
    mockResetCategoryPreferenceMutateAsync.mockResolvedValueOnce({
      categoryId: 'chilled_dairy_eggs',
      source: 'off_taxonomy',
      classifierVersion: '1',
    });
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Milch');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await waitFor(() => expect(mockResolvePlacementForItem).toHaveBeenCalled());

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Wasser, Saft & Softdrinks' }));

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Automatisch' }));

    expect(mockResetCategoryPreferenceMutateAsync).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        preference: expect.objectContaining({
          type: 'reset',
          input: expect.objectContaining({ householdId: 'hh-1' }),
        }),
      }),
    );
  });

  it('schreibt eine Haushaltspräferenz nur bei einer echten manuellen Entscheidung', async () => {
    const user = userEvent.setup();
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Testartikel');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await waitFor(() => expect(mockResolvePlacementForItem).toHaveBeenCalled());

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Wasser, Saft & Softdrinks' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        preference: expect.objectContaining({
          type: 'set',
          input: expect.objectContaining({ householdId: 'hh-1', categoryId: 'cold_drinks' }),
        }),
      }),
    );
  });

  it('erzeugt bei aktivem Flag Feedback für eine manuelle Abweichung', async () => {
    mockFeedbackEnabled = true;
    mockUserId = 'user-1';
    const user = userEvent.setup();
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Testartikel');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await waitFor(() => expect(mockResolvePlacementForItem).toHaveBeenCalled());

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Wasser, Saft & Softdrinks' }));
    await user.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: expect.objectContaining({
          eventType: 'manual_reassign',
          inputMethod: 'add_form',
          actorUserId: 'user-1',
          oldPlacementZone: 'other',
          newPlacementZone: 'cold_drinks',
        }),
      }),
    );
  });

  it('erzeugt bei aktivem Flag Feedback beim Entfernen einer aktiven Präferenz', async () => {
    mockFeedbackEnabled = true;
    mockUserId = 'user-1';
    mockResolvePlacementForItem.mockImplementation(async (_input, options) =>
      options?.omitPreferenceScope
        ? {
            ...defaultGlobalClassification,
            categoryId: 'other',
            source: 'name_fallback',
            globalClassification: defaultGlobalClassification,
            barcode: null,
          }
        : {
            ...defaultGlobalClassification,
            placementZoneId: 'chilled_dairy_eggs',
            categoryId: 'chilled_dairy_eggs',
            source: 'household_preference',
            globalClassification: defaultGlobalClassification,
            barcode: null,
          },
    );
    const user = userEvent.setup();
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Milch');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await waitFor(() => expect(mockResolvePlacementForItem).toHaveBeenCalled());

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Automatisch' }));
    await user.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: expect.objectContaining({
          eventType: 'reset_to_automatic',
          inputMethod: 'add_form',
          actorUserId: 'user-1',
          preferenceScope: 'household',
          oldPlacementZone: 'chilled_dairy_eggs',
          newPlacementZone: 'other',
        }),
      }),
    );
  });

  it('erzeugt bei deaktiviertem Flag kein Feedback', async () => {
    mockUserId = 'user-1';
    const user = userEvent.setup();
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Testartikel');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await waitFor(() => expect(mockResolvePlacementForItem).toHaveBeenCalled());

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Wasser, Saft & Softdrinks' }));
    await user.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ feedback: undefined }),
    );
  });

  it('erzeugt ohne angemeldeten Nutzer kein Feedback', async () => {
    mockFeedbackEnabled = true;
    mockUserId = null;
    const user = userEvent.setup();
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Testartikel');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await waitFor(() => expect(mockResolvePlacementForItem).toHaveBeenCalled());

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Wasser, Saft & Softdrinks' }));
    await user.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ feedback: undefined }),
    );
  });

  it('schliesst nach erfolgreichem lokalem Save und bleibt bei Fehler offen', async () => {
    const onDismiss = jest.fn();
    await renderForm(onDismiss);

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Hafermilch');
    await fireEvent.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));

    onDismiss.mockClear();
    const saveError = new Error('SQLite write failed');
    mockAddMutateAsync.mockRejectedValueOnce(saveError);

    await fireEvent.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(
      await screen.findByText('Artikel konnte nicht gespeichert werden. Bitte erneut versuchen.'),
    ).toBeOnTheScreen();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
