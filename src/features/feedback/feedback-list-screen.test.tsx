import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedbackListScreen } from '@/features/feedback/feedback-list-screen';

const mockPush = jest.fn();
let mockTicketsResult: { data: unknown; isLoading: boolean } = { data: [], isLoading: false };

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
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
  useMyTickets: () => mockTicketsResult,
}));

describe('FeedbackListScreen', () => {
  async function renderScreen() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <QueryClientProvider client={queryClient}>
          <FeedbackListScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockTicketsResult = { data: [], isLoading: false };
  });

  afterEach(async () => {
    // FlashList plant intern ein verzoegertes Layout-Update (siehe "docs/fehler
    // bei der test erstellung.md" #7) — ohne das Abraeumen hier warnt React nach
    // dem Test ueber ein Update ausserhalb von act(...).
    await act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('zeigt den leeren Zustand ohne Tickets', async () => {
    await renderScreen();

    expect(screen.getByText('Noch kein Feedback')).toBeTruthy();
  });

  it('zeigt Ticket-Nummer, Betreff, Typ und Status je Zeile', async () => {
    mockTicketsResult = {
      data: [
        {
          id: 'ticket-1',
          ticket_number: 142,
          subject: 'App stürzt ab',
          type: 'bug',
          status: 'in_progress',
          created_at: '2026-08-01T00:00:00.000Z',
        },
      ],
      isLoading: false,
    };
    await renderScreen();

    expect(screen.getByText('#142 · App stürzt ab')).toBeTruthy();
    expect(screen.getByText('In Bearbeitung')).toBeTruthy();
    expect(screen.getByText(/Fehler/)).toBeTruthy();
  });

  it('navigiert beim Antippen einer Zeile ins Ticket-Detail', async () => {
    mockTicketsResult = {
      data: [
        {
          id: 'ticket-1',
          ticket_number: 142,
          subject: 'App stürzt ab',
          type: 'bug',
          status: 'open',
          created_at: '2026-08-01T00:00:00.000Z',
        },
      ],
      isLoading: false,
    };
    await renderScreen();

    const user = userEvent.setup();
    await user.press(screen.getByText('#142 · App stürzt ab'));

    expect(mockPush).toHaveBeenCalledWith('/settings/feedback/ticket-1');
  });

  it('navigiert über den Neu-Button zum Formular', async () => {
    await renderScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: '+ Neu' }));

    expect(mockPush).toHaveBeenCalledWith('/settings/feedback/new');
  });
});
