import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedbackDetailScreen } from '@/features/feedback/feedback-detail-screen';
import { useFeedbackRealtime } from '@/features/feedback/use-feedback-realtime';

const mockSendReplyMutateAsync = jest.fn().mockResolvedValue({ id: 'msg-2' });
let mockTicket: { data: unknown } = { data: undefined };
let mockMessages: { data: unknown } = { data: [] };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'ticket-1' }),
  router: {
    push: jest.fn(),
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
  useTicket: () => mockTicket,
  useTicketMessages: () => mockMessages,
  useSendReplyMutation: () => ({
    mutateAsync: mockSendReplyMutateAsync,
    isPending: false,
  }),
}));

jest.mock('@/features/feedback/use-feedback-realtime', () => ({
  useFeedbackRealtime: jest.fn(),
}));

describe('FeedbackDetailScreen', () => {
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
          <FeedbackDetailScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockTicket = {
      data: {
        id: 'ticket-1',
        ticket_number: 142,
        subject: 'App stürzt ab',
        type: 'bug',
        status: 'in_progress',
      },
    };
    mockMessages = {
      data: [
        {
          id: 'msg-1',
          ticket_id: 'ticket-1',
          author_type: 'user',
          author_id: 'user-1',
          body: 'Beim Scannen stürzt die App ab.',
          created_at: '2026-08-01T00:00:00.000Z',
        },
        {
          id: 'msg-2',
          ticket_id: 'ticket-1',
          author_type: 'staff',
          author_id: null,
          body: 'Danke, wir schauen uns das an.',
          created_at: '2026-08-02T00:00:00.000Z',
        },
      ],
    };
  });

  it('zeigt den Thread in chronologischer Reihenfolge inklusive Team-Antwort', async () => {
    await renderScreen();

    const messages = screen.getAllByText(
      /Beim Scannen stürzt die App ab\.|Danke, wir schauen uns das an\./,
    );
    expect(messages[0]).toHaveTextContent('Beim Scannen stürzt die App ab.');
    expect(messages[1]).toHaveTextContent('Danke, wir schauen uns das an.');
    expect(screen.getByText('Team · 2.8.2026')).toBeTruthy();
  });

  it('sendet eine Antwort bei offenem Ticket', async () => {
    await renderScreen();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Antworten'), 'Noch ein Hinweis.');
    await user.press(screen.getByRole('button', { name: 'Senden' }));

    await waitFor(() => {
      expect(mockSendReplyMutateAsync).toHaveBeenCalledWith({
        ticketId: 'ticket-1',
        userId: 'user-1',
        body: 'Noch ein Hinweis.',
      });
    });
  });

  it('deaktiviert die Antwort-Eingabe bei geschlossenem Ticket', async () => {
    mockTicket = {
      data: {
        id: 'ticket-1',
        ticket_number: 142,
        subject: 'App stürzt ab',
        type: 'bug',
        status: 'closed',
      },
    };
    await renderScreen();

    expect(screen.queryByLabelText('Antworten')).not.toBeOnTheScreen();
    expect(
      screen.getByText('Dieses Ticket ist geschlossen. Neue Antworten sind nicht mehr möglich.'),
    ).toBeTruthy();
  });

  it('zeigt ein Banner, wenn der Realtime-Hook eine staff-Antwort meldet', async () => {
    await renderScreen();

    const onStaffReply = jest.mocked(useFeedbackRealtime).mock.calls[0][0].onStaffReply;
    await act(() => {
      onStaffReply?.('ticket-1');
    });

    expect(await screen.findByText('Das Team hat geantwortet.')).toBeTruthy();
  });
});
