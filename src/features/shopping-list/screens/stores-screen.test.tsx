import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Store } from '@/features/shopping-list/hooks/use-stores';
import { StoresScreen } from '@/features/shopping-list/screens/stores-screen';
import { i18n } from '@/i18n';

const mockAddMutateAsync = jest.fn().mockResolvedValue({});
const mockUpdateMutateAsync = jest.fn().mockResolvedValue({});
const mockDeleteMutateAsync = jest.fn().mockResolvedValue({});

let mockStores: Store[] | undefined = [];
let mockStoresLoading = false;
let mockStoresError = false;
const mockRefetch = jest.fn();
let mockAddPending = false;
let mockUpdatePending = false;
let mockDeletePending = false;
let mockShowPriceInMarketView = false;
const mockSetShowPriceInMarketView = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({
    activeHousehold: { id: 'hh-1', name: 'Familie Test' },
  }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('../preferences/display-settings', () => ({
  useShowPriceInMarketView: () => ({ data: mockShowPriceInMarketView }),
  useSetShowPriceInMarketView: () => ({ mutate: mockSetShowPriceInMarketView }),
}));

jest.mock('../hooks/use-stores', () => ({
  useStores: () => ({
    data: mockStores,
    isLoading: mockStoresLoading,
    isError: mockStoresError,
    refetch: mockRefetch,
  }),
  useAddStoreMutation: () => ({ mutateAsync: mockAddMutateAsync, isPending: mockAddPending }),
  useUpdateStoreMutation: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: mockUpdatePending,
  }),
  useDeleteStoreMutation: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: mockDeletePending,
  }),
  findStoreByName: (stores: Store[], name: string) =>
    stores.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null,
}));

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: () => ({
    data: mockStores,
    isLoading: mockStoresLoading,
    isError: mockStoresError,
    refetch: mockRefetch,
  }),
  useAddStoreMutation: () => ({ mutateAsync: mockAddMutateAsync, isPending: mockAddPending }),
  useUpdateStoreMutation: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: mockUpdatePending,
  }),
  useDeleteStoreMutation: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: mockDeletePending,
  }),
  findStoreByName: (stores: Store[], name: string) =>
    stores.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null,
}));

jest.spyOn(Alert, 'alert');

describe('StoresScreen', () => {
  async function renderScreen() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <QueryClientProvider client={queryClient}>
          <StoresScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStores = [];
    mockStoresLoading = false;
    mockStoresError = false;
    mockRefetch.mockReset();
    mockAddPending = false;
    mockUpdatePending = false;
    mockDeletePending = false;
    mockShowPriceInMarketView = false;
    await i18n.changeLanguage('de');
  });

  it('rendert Titel und Formular', async () => {
    await renderScreen();

    expect(screen.getByText('Einkaufsliste')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Preis in der Marktansicht anzeigen' })).toHaveProp(
      'value',
      false,
    );
    expect(screen.getByText('Neuen Markt hinzufügen')).toBeTruthy();
  });

  it('ändert die persönliche Preisansicht über die Einstellung', async () => {
    await renderScreen();

    await fireEvent(
      screen.getByRole('switch', { name: 'Preis in der Marktansicht anzeigen' }),
      'valueChange',
      true,
    );

    expect(mockSetShowPriceInMarketView).toHaveBeenCalledWith(true);
  });

  it('zeigt Liste vorhandener Märkte', async () => {
    mockStores = [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Rewe Center',
        color: '#E53E3E',
        sort_order: 0,
        category_order: null,
      },
      {
        id: 'store-2',
        household_id: 'hh-1',
        name: 'Wochenmarkt Süd',
        color: '#38A169',
        sort_order: 1,
        category_order: null,
      },
    ];

    await renderScreen();

    expect(screen.getByText('Rewe Center')).toBeTruthy();
    expect(screen.getByText('Wochenmarkt Süd')).toBeTruthy();
  });

  it('zeigt den Empty-State ohne vorhandene Märkte', async () => {
    await renderScreen();

    expect(screen.getByText('Keine Märkte vorhanden.')).toBeTruthy();
  });

  it('zeigt den Loading-State der Märkte', async () => {
    mockStoresLoading = true;

    await renderScreen();

    expect(screen.getByText('Lädt...')).toBeTruthy();
    expect(screen.queryByText('Keine Märkte vorhanden.')).toBeNull();
  });

  it('zeigt einen initialen Ladefehler mit gezieltem Retry', async () => {
    mockStores = undefined;
    mockStoresError = true;

    await renderScreen();

    expect(screen.getByText('Märkte konnten nicht geladen werden.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('behält vorhandene Märkte bei einem Refresh-Fehler sichtbar', async () => {
    mockStores = [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Rewe Center',
        color: '#E53E3E',
        sort_order: 0,
        category_order: null,
      },
    ];
    mockStoresError = true;

    await renderScreen();

    expect(screen.getByText('Rewe Center')).toBeTruthy();
    expect(screen.queryByText('Märkte konnten nicht geladen werden.')).toBeNull();
  });

  it('übernimmt Preset und Farbwahl mit dem korrekten selected-A11y-State', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'REWE' }));
    expect(screen.getByDisplayValue('REWE')).toBeTruthy();

    const firstColor = screen.getByRole('button', { name: 'Farbe #B5623F' });
    const secondColor = screen.getByRole('button', { name: 'Farbe #C08A4E' });

    expect(firstColor).toBeSelected();
    expect(firstColor.props.accessibilityState).toEqual({ selected: true });
    expect(secondColor).not.toBeSelected();
    expect(secondColor.props.accessibilityState).toEqual({ selected: false });

    await user.press(secondColor);

    expect(firstColor).not.toBeSelected();
    expect(firstColor.props.accessibilityState).toEqual({ selected: false });
    expect(secondColor).toBeSelected();
    expect(secondColor.props.accessibilityState).toEqual({ selected: true });
  });

  it('erstellt ein neues Geschäft beim Absenden', async () => {
    await renderScreen();

    const input = screen.getByPlaceholderText('z.B. REWE, Aldi, Lidl...');
    await fireEvent.changeText(input, 'Bioladen');

    const addBtn = screen.getByRole('button', { name: 'Hinzufügen' });
    await fireEvent.press(addBtn);

    await waitFor(() => {
      expect(mockAddMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          household_id: 'hh-1',
          name: 'Bioladen',
        }),
      );
    });
  });

  it('zeigt den Loading-State der Add-Mutation', async () => {
    mockAddPending = true;

    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText('z.B. REWE, Aldi, Lidl...'), 'Bioladen');

    const addButton = screen.getByRole('button', { name: 'Hinzufügen' });
    expect(addButton).toBeDisabled();
    expect(addButton).toBeBusy();
  });

  it('meldet einen Add-Fehler und zeigt die Fehlermeldung', async () => {
    mockAddMutateAsync.mockRejectedValueOnce(new Error('Speichern fehlgeschlagen'));

    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText('z.B. REWE, Aldi, Lidl...'), 'Bioladen');
    await fireEvent.press(screen.getByRole('button', { name: 'Hinzufügen' }));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenLastCalledWith('Fehler', 'Speichern fehlgeschlagen');
    });
  });

  it('bearbeitet Name und Farbe eines vorhandenen Marktes', async () => {
    mockStores = [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Rewe Center',
        color: '#B5623F',
        sort_order: 0,
        category_order: null,
      },
    ];

    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Rewe Center bearbeiten' }));

    const nameInput = screen.getByDisplayValue('Rewe Center');
    await fireEvent.changeText(nameInput, 'Rewe City');
    const editColorButtons = screen.getAllByRole('button', { name: 'Farbe #C08A4E' });
    expect(editColorButtons).toHaveLength(2);
    await fireEvent.press(editColorButtons[1]);
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Rewe City',
        color: '#C08A4E',
      });
    });
  });

  it('zeigt den Loading-State der Update-Mutation', async () => {
    mockUpdatePending = true;
    mockStores = [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Rewe Center',
        color: '#B5623F',
        sort_order: 0,
        category_order: null,
      },
    ];

    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Rewe Center bearbeiten' }));

    expect(screen.getByRole('button', { name: 'Speichern' })).toBeBusy();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });

  it('meldet einen Update-Fehler mit Fallback-Text', async () => {
    mockUpdateMutateAsync.mockRejectedValueOnce('offline');
    mockStores = [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Rewe Center',
        color: '#B5623F',
        sort_order: 0,
        category_order: null,
      },
    ];

    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Rewe Center bearbeiten' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenLastCalledWith('Fehler', 'Fehler beim Aktualisieren');
    });
  });

  it('fordert vor dem Löschen eine Bestätigung an und löscht danach', async () => {
    mockStores = [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Rewe Center',
        color: '#B5623F',
        sort_order: 0,
        category_order: null,
      },
    ];

    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Rewe Center löschen' }));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Markt löschen',
      'Möchtest du den Markt "Rewe Center" wirklich löschen?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Abbrechen', style: 'cancel' }),
        expect.objectContaining({ text: 'Löschen', style: 'destructive' }),
      ]),
    );

    const alertCall = jest.mocked(Alert.alert).mock.calls.at(-1);
    const deleteAction = alertCall?.[2]?.find((action) => action.text === 'Löschen');
    expect(deleteAction).toBeDefined();
    await deleteAction?.onPress?.();

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith({
        id: 'store-1',
        household_id: 'hh-1',
      });
    });
  });

  it('zeigt den Loading-State der Delete-Mutation', async () => {
    mockDeletePending = true;
    mockStores = [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Rewe Center',
        color: '#B5623F',
        sort_order: 0,
        category_order: null,
      },
    ];

    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Rewe Center löschen' }));
    const alertCall = jest.mocked(Alert.alert).mock.calls.at(-1);
    const deleteAction = alertCall?.[2]?.find((action) => action.text === 'Löschen');

    await deleteAction?.onPress?.();

    expect(mockDeleteMutateAsync).toHaveBeenCalledWith({
      id: 'store-1',
      household_id: 'hh-1',
    });
  });

  it('meldet einen Delete-Fehler mit Fallback-Text', async () => {
    mockDeleteMutateAsync.mockRejectedValueOnce(null);
    mockStores = [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Rewe Center',
        color: '#B5623F',
        sort_order: 0,
        category_order: null,
      },
    ];

    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Rewe Center löschen' }));
    const alertCall = jest.mocked(Alert.alert).mock.calls.at(-1);
    const deleteAction = alertCall?.[2]?.find((action) => action.text === 'Löschen');

    await deleteAction?.onPress?.();

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenLastCalledWith('Fehler', 'Fehler beim Löschen');
    });
  });

  it('warnt bei doppeltem Geschäftsnamen', async () => {
    mockStores = [
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Rewe',
        color: '#E53E3E',
        sort_order: 0,
        category_order: null,
      },
    ];

    await renderScreen();

    const input = screen.getByPlaceholderText('z.B. REWE, Aldi, Lidl...');
    await fireEvent.changeText(input, 'rewe');

    const addBtn = screen.getByRole('button', { name: 'Hinzufügen' });
    await fireEvent.press(addBtn);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Markt existiert bereits',
        expect.stringContaining('Rewe'),
      );
    });
  });
});
