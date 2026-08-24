import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AddItemForm } from '@/features/shopping-list/forms/add-item-form';

const mockAddMutateAsync = jest.fn().mockResolvedValue({});
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

jest.mock('@/lib/posthog', () => ({
  useFeatureFlag: () => mockFeedbackEnabled,
}));

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
  resolvePlacementForItem: (...args: unknown[]) => mockResolvePlacementForItem(...args),
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
  async function renderForm(onDismiss = jest.fn()) {
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
          <AddItemForm householdId="hh-1" onDismiss={onDismiss} />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeedbackEnabled = false;
    mockUserId = null;
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
    mockAddMutateAsync.mockRejectedValueOnce(new Error('SQLite write failed'));
    await fireEvent.press(screen.getByRole('button', { name: 'Zur Einkaufsliste hinzufügen' }));

    expect(
      await screen.findByText('Artikel konnte nicht gespeichert werden. Bitte erneut versuchen.'),
    ).toBeOnTheScreen();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
