import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getSupabase } from '@/lib/supabase';
import { useFeedbackRealtime } from './use-feedback-realtime';

const handlers: Record<string, (payload: unknown) => void> = {};

const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();
const mockOn = jest.fn();
const mockSubscribe = jest.fn();

function channelBuilder() {
  return { on: mockOn, subscribe: mockSubscribe };
}

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(handlers)) delete handlers[key];

  mockOn.mockImplementation(
    (
      _event: string,
      config: { event: string; table: string },
      handler: (payload: unknown) => void,
    ) => {
      handlers[`${config.table}:${config.event}`] = handler;
      return channelBuilder();
    },
  );
  mockSubscribe.mockImplementation(() => channelBuilder());
  mockChannel.mockImplementation(() => channelBuilder());

  jest.mocked(getSupabase).mockReturnValue({
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  } as unknown as ReturnType<typeof getSupabase>);
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

it('abonniert einen nach Nutzer benannten Channel fuer Tickets und Nachrichten', async () => {
  await renderHook(() => useFeedbackRealtime({ userId: 'user-1' }), { wrapper });

  expect(mockChannel).toHaveBeenCalledWith('feedback:user-1');
  expect(mockOn).toHaveBeenCalledWith(
    'postgres_changes',
    expect.objectContaining({ event: 'UPDATE', table: 'feedback_tickets' }),
    expect.any(Function),
  );
  expect(mockOn).toHaveBeenCalledWith(
    'postgres_changes',
    expect.objectContaining({ event: 'INSERT', table: 'feedback_messages' }),
    expect.any(Function),
  );
  expect(mockSubscribe).toHaveBeenCalled();
});

it('meldet einen Uebergang zu in_progress, aber nicht bei anderen Statuswechseln', async () => {
  const onTicketInProgress = jest.fn();
  await renderHook(() => useFeedbackRealtime({ userId: 'user-1', onTicketInProgress }), {
    wrapper,
  });

  handlers['feedback_tickets:UPDATE']({
    old: { id: 'ticket-1', status: 'open' },
    new: { id: 'ticket-1', status: 'in_progress' },
  });
  expect(onTicketInProgress).toHaveBeenCalledWith('ticket-1');

  onTicketInProgress.mockClear();
  handlers['feedback_tickets:UPDATE']({
    old: { id: 'ticket-1', status: 'in_progress' },
    new: { id: 'ticket-1', status: 'answered' },
  });
  expect(onTicketInProgress).not.toHaveBeenCalled();
});

it('meldet eine staff-Antwort nur fuer das beobachtete Ticket', async () => {
  const onStaffReply = jest.fn();
  await renderHook(
    () => useFeedbackRealtime({ userId: 'user-1', ticketId: 'ticket-1', onStaffReply }),
    {
      wrapper,
    },
  );

  handlers['feedback_messages:INSERT']({
    new: { id: 'msg-1', ticket_id: 'ticket-2', author_type: 'staff' },
  });
  expect(onStaffReply).not.toHaveBeenCalled();

  handlers['feedback_messages:INSERT']({
    new: { id: 'msg-2', ticket_id: 'ticket-1', author_type: 'user' },
  });
  expect(onStaffReply).not.toHaveBeenCalled();

  handlers['feedback_messages:INSERT']({
    new: { id: 'msg-3', ticket_id: 'ticket-1', author_type: 'staff' },
  });
  expect(onStaffReply).toHaveBeenCalledWith('ticket-1');
});

it('raeumt den Channel beim Unmount ab', async () => {
  const { unmount } = await renderHook(() => useFeedbackRealtime({ userId: 'user-1' }), {
    wrapper,
  });

  await unmount();

  expect(mockRemoveChannel).toHaveBeenCalled();
});

it('abonniert nichts ohne angemeldeten Nutzer', async () => {
  await renderHook(() => useFeedbackRealtime({ userId: undefined }), { wrapper });

  expect(mockChannel).not.toHaveBeenCalled();
});
