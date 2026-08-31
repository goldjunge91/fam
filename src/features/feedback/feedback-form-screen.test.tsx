import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedbackFormScreen } from '@/features/feedback/feedback-form-screen';

const mockCreateMutateAsync = jest
  .fn()
  .mockResolvedValue({ id: 'ticket-1', ticket_number: 142, status: 'open' });
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

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } }, isLoading: false }),
}));

jest.mock('@/features/feedback/api', () => ({
  useCreateTicketMutation: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
}));

describe('FeedbackFormScreen', () => {
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
          <FeedbackFormScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert das Formular mit Typ-Auswahl, Betreff und Nachricht', async () => {
    await renderScreen();

    expect(screen.getByText('Feedback geben')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Fehler' })).toBeTruthy();
    expect(screen.getByLabelText('Betreff')).toBeTruthy();
    expect(screen.getByLabelText('Nachricht')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Absenden' })).toBeTruthy();
  });

  it('blockiert das Absenden ohne Betreff oder Nachricht', async () => {
    await renderScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Absenden' }));

    expect(await screen.findByText('Bitte fülle Betreff und Nachricht aus.')).toBeTruthy();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });

  it('legt ein Ticket an und zeigt danach die Ticket-Nummer', async () => {
    await renderScreen();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Betreff'), 'App stürzt ab');
    await user.type(screen.getByLabelText('Nachricht'), 'Beim Scannen eines Barcodes.');
    await user.press(screen.getByRole('button', { name: 'Absenden' }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'bug',
        subject: 'App stürzt ab',
        body: 'Beim Scannen eines Barcodes.',
      });
    });

    expect(
      await screen.findByText(
        'Dein Ticket #142 ist eingegangen. Wir melden uns, sobald sich etwas tut.',
      ),
    ).toBeTruthy();
  });
});
