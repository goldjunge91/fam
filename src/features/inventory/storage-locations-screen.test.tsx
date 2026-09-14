import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StorageLocationsScreen } from '@/features/inventory/storage-locations-screen';
import type { StorageLocation } from '@/features/inventory/use-storage-locations';

const mockAddLocationMutateAsync = jest.fn().mockResolvedValue({});
const mockUpdateLocationMutateAsync = jest.fn().mockResolvedValue({});
const mockDeleteLocationMutateAsync = jest.fn().mockResolvedValue({});
const mockRefetch = jest.fn().mockResolvedValue({});

let mockLocations: StorageLocation[] | undefined = [];
let mockIsLoading = false;
let mockIsError = false;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({
    activeHousehold: { id: 'hh-1', name: 'Mein Haushalt' },
  }),
}));

jest.mock('@/features/inventory/use-storage-locations', () => ({
  useStorageLocations: () => ({
    data: mockLocations,
    isLoading: mockIsLoading,
    isError: mockIsError,
    refetch: mockRefetch,
  }),
  useAddStorageLocationMutation: () => ({
    mutateAsync: mockAddLocationMutateAsync,
    isPending: false,
  }),
  useUpdateStorageLocationMutation: () => ({
    mutateAsync: mockUpdateLocationMutateAsync,
    isPending: false,
  }),
  useDeleteStorageLocationMutation: () => ({
    mutateAsync: mockDeleteLocationMutateAsync,
    isPending: false,
  }),
}));

describe('StorageLocationsScreen', () => {
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
          <StorageLocationsScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocations = [];
    mockIsLoading = false;
    mockIsError = false;
  });

  const location: StorageLocation = {
    id: 'loc-1',
    household_id: 'hh-1',
    name: 'Vorratsschrank',
    kind: 'pantry',
    sort_order: 0,
  };

  it('rendert Titel und Formular', async () => {
    await renderScreen();

    expect(screen.getByText('Lagerorte verwalten')).toBeTruthy();
    expect(screen.getByText('Neuen Lagerort hinzufügen')).toBeTruthy();
  });

  it('erstellt einen neuen Lagerort', async () => {
    await renderScreen();

    const input = screen.getByPlaceholderText('z.B. Abstellkammer, Keller, Vorratsschrank...');
    await fireEvent.changeText(input, 'Gewürzregal');

    const addBtn = screen.getByRole('button', { name: 'Hinzufügen' });
    await fireEvent.press(addBtn);

    await waitFor(() => {
      expect(mockAddLocationMutateAsync).toHaveBeenCalledWith({
        household_id: 'hh-1',
        name: 'Gewürzregal',
      });
    });
  });

  it('zeigt den erfolgreichen Empty-State', async () => {
    await renderScreen();

    expect(screen.getByText('Keine Lagerorte vorhanden.')).toBeOnTheScreen();
  });

  it('zeigt den Ladezustand der Lagerorte', async () => {
    mockIsLoading = true;

    await renderScreen();

    expect(screen.getByText('Lädt...')).toBeOnTheScreen();
  });

  it('zeigt den initialen Fehlerzustand und löst einen Retry aus', async () => {
    mockLocations = undefined;
    mockIsError = true;

    await renderScreen();

    expect(screen.getByRole('alert')).toHaveTextContent('Lagerorte konnten nicht geladen werden.');
    await fireEvent.press(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('zeigt bei leerem stale Ergebnis weiterhin den Empty-State und Retry', async () => {
    mockLocations = [];
    mockIsError = true;

    await renderScreen();

    expect(screen.getByText('Keine Lagerorte vorhanden.')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Lagerorte konnten nicht aktualisiert werden.',
    );
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeOnTheScreen();
  });

  it('behält stale Lagerorte bei einem fehlgeschlagenen Refetch sichtbar', async () => {
    mockLocations = [location];
    mockIsError = true;

    await renderScreen();

    expect(screen.getByText('Vorratsschrank')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Lagerorte konnten nicht aktualisiert werden.',
    );
    expect(screen.getByRole('button', { name: 'Umbenennen' })).toBeOnTheScreen();
  });

  it('bearbeitet einen vorhandenen Lagerort', async () => {
    mockLocations = [location];

    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Umbenennen' }));
    await fireEvent.changeText(screen.getByDisplayValue('Vorratsschrank'), 'Keller');
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(mockUpdateLocationMutateAsync).toHaveBeenCalledWith({
        id: 'loc-1',
        household_id: 'hh-1',
        name: 'Keller',
      });
    });
  });

  it('bestätigt das Löschen eines vorhandenen Lagerorts', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockLocations = [location];

    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Löschen' }));

    expect(alertSpy).toHaveBeenCalledWith(
      'Lagerort löschen',
      'Möchtest du den Lagerort "Vorratsschrank" wirklich löschen?',
      expect.any(Array),
    );
    const actions = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await actions.find((action) => action.text === 'Löschen')?.onPress?.();

    expect(mockDeleteLocationMutateAsync).toHaveBeenCalledWith({
      id: 'loc-1',
      household_id: 'hh-1',
    });
    alertSpy.mockRestore();
  });
});
