import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StorageLocationsScreen } from '@/features/inventory/storage-locations-screen';
import type { StorageLocation } from '@/features/inventory/use-storage-locations';

const mockAddLocationMutateAsync = jest.fn().mockResolvedValue({});
const mockUpdateLocationMutateAsync = jest.fn().mockResolvedValue({});
const mockDeleteLocationMutateAsync = jest.fn().mockResolvedValue({});

let mockLocations: StorageLocation[] = [];

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
  useStorageLocations: () => ({ data: mockLocations, isLoading: false }),
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
  });

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
});
