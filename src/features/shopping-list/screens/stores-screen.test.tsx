import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Store } from '@/features/shopping-list/hooks/use-stores';
import { StoresScreen } from '@/features/shopping-list/screens/stores-screen';

const mockAddMutateAsync = jest.fn().mockResolvedValue({});
const mockUpdateMutateAsync = jest.fn().mockResolvedValue({});
const mockDeleteMutateAsync = jest.fn().mockResolvedValue({});

let mockStores: Store[] = [];

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({
    activeHousehold: { id: 'hh-1', name: 'Familie Test' },
  }),
}));

jest.mock('../hooks/use-stores', () => ({
  useStores: () => ({ data: mockStores, isLoading: false }),
  useAddStoreMutation: () => ({ mutateAsync: mockAddMutateAsync, isPending: false }),
  useUpdateStoreMutation: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
  useDeleteStoreMutation: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
  findStoreByName: (stores: Store[], name: string) =>
    stores.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null,
}));

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: () => ({ data: mockStores, isLoading: false }),
  useAddStoreMutation: () => ({ mutateAsync: mockAddMutateAsync, isPending: false }),
  useUpdateStoreMutation: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
  useDeleteStoreMutation: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockStores = [];
  });

  it('rendert Titel und Formular', async () => {
    await renderScreen();

    expect(screen.getByText('Märkte verwalten')).toBeTruthy();
    expect(screen.getByText('Neuen Markt hinzufügen')).toBeTruthy();
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
