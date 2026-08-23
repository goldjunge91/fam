import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AddItemForm } from '@/features/shopping-list/forms/add-item-form';

const mockAddMutateAsync = jest.fn().mockResolvedValue({});
const mockResolveCategoryForItem = jest.fn().mockResolvedValue({
  categoryId: null,
  source: null,
  classifierVersion: '1',
});
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

jest.mock('../preferences/api', () => ({
  resolveCategoryForItem: (...args: unknown[]) => mockResolveCategoryForItem(...args),
}));

// Isoliert die (nicht abgefangene, laenger als der Test dauernde) debounced
// Live-Suche von `ProductSearchDropdown` — ohne diesen Mock crasht ihr
// `getDatabase()`-Aufruf mit "NativeDatabase is not a constructor" und
// leakt in ein spaeteres Test-Timing-Fenster (nicht Teil dieses Formulars,
// nichts, was #223 Paket 8 hier aendert).
jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
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
    await waitFor(() => expect(mockResolveCategoryForItem).toHaveBeenCalled());

    const addBtn = screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' });
    await fireEvent.press(addBtn);

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: 'hh-1',
        name: 'Hafermilch',
      }),
    );
  });

  it('zeigt die automatisch aufgelöste Kategorie im Kategoriefeld an', async () => {
    mockResolveCategoryForItem.mockResolvedValueOnce({
      categoryId: 'meat_poultry',
      source: 'name_fallback',
      classifierVersion: '1',
    });
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Schnitzel');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));

    expect(await screen.findByText('Fleisch & Geflügel')).toBeOnTheScreen();
    expect(screen.getByText('automatisch · Name')).toBeOnTheScreen();
  });

  it('eine manuelle Kategorie bleibt bei einer Namensänderung erhalten', async () => {
    const user = userEvent.setup();
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Testartikel');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await waitFor(() => expect(mockResolveCategoryForItem).toHaveBeenCalled());

    await user.press(screen.getByRole('button', { name: /Kategorie:/ }));
    await user.press(screen.getByRole('button', { name: 'Getränke' }));
    expect(screen.getByText('Getränke')).toBeOnTheScreen();
    expect(screen.getByText('manuell gewählt')).toBeOnTheScreen();

    mockResolveCategoryForItem.mockClear();
    await fireEvent.changeText(
      screen.getByPlaceholderText('Artikel suchen'),
      'Testartikel geändert',
    );

    expect(mockResolveCategoryForItem).not.toHaveBeenCalled();
    expect(screen.getByText('Getränke')).toBeOnTheScreen();
    expect(screen.getByText('manuell gewählt')).toBeOnTheScreen();
  });

  it('bewusstes "Sonstiges" bleibt bei einer Namensänderung bestehen', async () => {
    const user = userEvent.setup();
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Grillkohle');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await waitFor(() => expect(mockResolveCategoryForItem).toHaveBeenCalled());

    await user.press(screen.getByRole('button', { name: /Kategorie:/ }));
    await user.press(screen.getByRole('button', { name: 'Sonstiges' }));
    expect(screen.getByText('bewusst „Sonstiges“')).toBeOnTheScreen();

    mockResolveCategoryForItem.mockClear();
    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Grillkohle Menge 5');

    expect(mockResolveCategoryForItem).not.toHaveBeenCalled();
    expect(screen.getByText('bewusst „Sonstiges“')).toBeOnTheScreen();
  });

  it('"Automatisch" löst die Präferenz-Reset-Mutation aus und übernimmt das Ergebnis', async () => {
    const user = userEvent.setup();
    mockResetCategoryPreferenceMutateAsync.mockResolvedValueOnce({
      categoryId: 'dairy_eggs',
      source: 'off_taxonomy',
      classifierVersion: '1',
    });
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Milch');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await waitFor(() => expect(mockResolveCategoryForItem).toHaveBeenCalled());

    await user.press(screen.getByRole('button', { name: /Kategorie:/ }));
    await user.press(screen.getByRole('button', { name: 'Getränke' }));

    await user.press(screen.getByRole('button', { name: /Kategorie:/ }));
    await user.press(screen.getByRole('button', { name: 'Automatisch' }));

    expect(mockResetCategoryPreferenceMutateAsync).toHaveBeenCalled();
    expect(await screen.findByText('Molkerei, Käse & Eier')).toBeOnTheScreen();
    expect(screen.getByText('automatisch · Produktdaten')).toBeOnTheScreen();
  });

  it('schreibt eine Haushaltspräferenz nur bei einer echten manuellen Entscheidung', async () => {
    const user = userEvent.setup();
    await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Artikel suchen'), 'Testartikel');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben' }));
    await waitFor(() => expect(mockResolveCategoryForItem).toHaveBeenCalled());

    await user.press(screen.getByRole('button', { name: /Kategorie:/ }));
    await user.press(screen.getByRole('button', { name: 'Getränke' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(mockSetCategoryPreferenceMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: 'hh-1', categoryId: 'beverages' }),
    );
  });
});
