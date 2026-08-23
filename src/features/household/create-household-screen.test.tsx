import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CreateHouseholdScreen } from '@/features/household/create-household-screen';

const mockCreateMutateAsync = jest.fn().mockResolvedValue({ id: 'hh-1', name: 'Neuer Haushalt' });
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: jest.fn(),
    canGoBack: () => false,
  },
  useNavigation: () => ({
    canGoBack: () => false,
    addListener: () => () => {},
  }),
}));

jest.mock('@/features/household/api', () => ({
  useCreateHouseholdMutation: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
}));

describe('CreateHouseholdScreen', () => {
  async function renderScreen() {
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
          <CreateHouseholdScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert Formular für neuen Haushalt', async () => {
    await renderScreen();

    expect(screen.getByText('Haushalt erstellen')).toBeTruthy();
    expect(screen.getByLabelText('Name deines Haushalts')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Erstellen' })).toBeTruthy();
  });

  it('validiert leeren Haushaltsnamen', async () => {
    await renderScreen();

    const user = userEvent.setup();
    const submitBtn = screen.getByRole('button', { name: 'Erstellen' });
    await user.press(submitBtn);

    expect(await screen.findByText('Bitte gib einen Namen für den Haushalt ein.')).toBeTruthy();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });

  it('erstellt neuen Haushalt und navigiert zum Dashboard', async () => {
    await renderScreen();

    const user = userEvent.setup();
    const input = screen.getByLabelText('Name deines Haushalts');
    await user.type(input, 'WG Sonnenschein');

    const submitBtn = screen.getByRole('button', { name: 'Erstellen' });
    await user.press(submitBtn);

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith('WG Sonnenschein');
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });
});
