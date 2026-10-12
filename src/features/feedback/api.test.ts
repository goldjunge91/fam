import { renderHook } from '@testing-library/react-native';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import {
  type CreateTicketInput,
  createTicket,
  type FeedbackMessage,
  type FeedbackTicket,
  myTicketsQueryKey,
  type SendReplyInput,
  sendReply,
  ticketMessagesQueryKey,
  ticketQueryKey,
  useCreateTicketMutation,
  useMyTickets,
  useSendReplyMutation,
  useTicket,
  useTicketMessages,
} from './api';

const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockInsert = jest.fn();
const mockOrder = jest.fn();
const mockEq = jest.fn();
const mockFrom = jest.fn();
const mockUseQuery = jest.fn<unknown, [unknown]>();
const mockUseMutation = jest.fn<unknown, [unknown]>();
const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
  useMutation: (options: unknown) => mockUseMutation(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(),
}));

const queryBuilder = {
  select: mockSelect,
  single: mockSingle,
  insert: mockInsert,
  order: mockOrder,
  eq: mockEq,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockImplementation((options) => options);
  mockUseMutation.mockImplementation((options) => options);
  mockSelect.mockReturnValue(queryBuilder);
  mockSingle.mockResolvedValue({
    data: { id: 'ticket-1', ticket_number: 142, status: 'open' },
    error: null,
  });
  mockInsert.mockReturnValue(queryBuilder);
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockEq.mockReturnValue(queryBuilder);
  mockFrom.mockReturnValue(queryBuilder);
  jest
    .mocked(getSupabase)
    .mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabase>);
});

it('trennt Ticket-Listen nach Nutzer', () => {
  expect(myTicketsQueryKey('user-1')).toEqual(['feedback', 'tickets', 'user-1']);
});

it('laedt Tickets nur fuer einen Nutzer und behandelt eine leere Antwort als leere Liste', async () => {
  await renderHook(() => useMyTickets(undefined));
  const disabled = mockUseQuery.mock.calls.at(-1)?.[0] as {
    enabled: boolean;
    queryKey: readonly unknown[];
  };
  expect(disabled.enabled).toBe(false);

  mockOrder.mockResolvedValueOnce({ data: null, error: null });
  await renderHook(() => useMyTickets('user-1'));
  const enabled = mockUseQuery.mock.calls.at(-1)?.[0] as {
    enabled: boolean;
    queryFn: () => Promise<FeedbackTicket[]>;
  };
  expect(enabled.enabled).toBe(true);
  await expect(enabled.queryFn()).resolves.toEqual([]);
  expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
});

it('meldet Ticket-Listenfehler als Error', async () => {
  mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'ticket query failed' } });
  await renderHook(() => useMyTickets('user-1'));
  const options = mockUseQuery.mock.calls.at(-1)?.[0] as {
    queryFn: () => Promise<FeedbackTicket[]>;
  };

  await expect(options.queryFn()).rejects.toThrow('ticket query failed');
});

it('legt Ticket und initiale Nachricht als zwei Inserts an und gibt das Ticket zurueck', async () => {
  const ticket = await createTicket({
    userId: 'user-1',
    type: 'bug',
    subject: 'App stuerzt ab',
    body: 'Beim Scannen eines Barcodes stuerzt die App ab.',
  });

  expect(mockFrom).toHaveBeenNthCalledWith(1, 'feedback_tickets');
  expect(mockInsert).toHaveBeenNthCalledWith(1, {
    user_id: 'user-1',
    type: 'bug',
    subject: 'App stuerzt ab',
  });

  expect(mockFrom).toHaveBeenNthCalledWith(2, 'feedback_messages');
  expect(mockInsert).toHaveBeenNthCalledWith(2, {
    ticket_id: 'ticket-1',
    author_type: 'user',
    author_id: 'user-1',
    body: 'Beim Scannen eines Barcodes stuerzt die App ab.',
  });

  expect(ticket).toEqual({ id: 'ticket-1', ticket_number: 142, status: 'open' });
});

it('weist eine leere Betreffzeile vor dem Insert zurueck', async () => {
  await expect(
    createTicket({ userId: 'user-1', type: 'bug', subject: '   ', body: 'Text' }),
  ).rejects.toThrow();

  expect(mockFrom).not.toHaveBeenCalled();
});

it.each([
  ['fehlende Nutzer-ID', { userId: '', type: 'bug' as const, subject: 'Titel', body: 'Text' }],
  [
    'Betreff mit mehr als 200 Zeichen',
    { userId: 'user-1', type: 'bug' as const, subject: 'x'.repeat(201), body: 'Text' },
  ],
  [
    'Nachricht mit mehr als 4000 Zeichen',
    { userId: 'user-1', type: 'bug' as const, subject: 'Titel', body: 'x'.repeat(4001) },
  ],
])('weist ungueltige Ticket-Eingaben mit %s vor dem Insert zurueck', async (_label, input) => {
  await expect(createTicket(input)).rejects.toThrow();
  expect(mockFrom).not.toHaveBeenCalled();
});

it('wirft die Postgres-Fehlermeldung, wenn der Ticket-Insert fehlschlaegt', async () => {
  mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } });

  await expect(
    createTicket({ userId: 'user-1', type: 'bug', subject: 'x', body: 'y' }),
  ).rejects.toThrow('permission denied');
});

it('wirft die Postgres-Fehlermeldung, wenn die initiale Nachricht fehlschlaegt', async () => {
  mockInsert.mockReturnValueOnce(queryBuilder).mockResolvedValueOnce({
    error: { message: 'message insert failed' },
  });

  await expect(
    createTicket({ userId: 'user-1', type: 'suggestion', subject: 'Titel', body: 'Text' }),
  ).rejects.toThrow('message insert failed');
  expect(mockInsert).toHaveBeenCalledTimes(2);
});

it('trennt Thread-Abfragen nach Ticket', () => {
  expect(ticketMessagesQueryKey('ticket-1')).toEqual([
    'feedback',
    'ticket',
    'ticket-1',
    'messages',
  ]);
});

it('laedt ein Ticket nach seiner ID und wirft Abfragefehler weiter', async () => {
  expect(ticketQueryKey(undefined)).toEqual(['feedback', 'ticket', undefined]);
  await renderHook(() => useTicket(undefined));
  const disabledQuery = mockUseQuery.mock.calls.at(-1)?.[0] as { enabled: boolean } | undefined;
  expect(disabledQuery?.enabled).toBe(false);

  await renderHook(() => useTicket('ticket-1'));
  const options = mockUseQuery.mock.calls.at(-1)?.[0] as {
    enabled: boolean;
    queryFn: () => Promise<FeedbackTicket>;
  };
  expect(options.enabled).toBe(true);
  await expect(options.queryFn()).resolves.toMatchObject({ id: 'ticket-1' });
  expect(mockEq).toHaveBeenCalledWith('id', 'ticket-1');

  mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'ticket missing' } });
  await expect(options.queryFn()).rejects.toThrow('ticket missing');
});

it('laedt Nachrichten aufsteigend und wirft Thread-Abfragefehler weiter', async () => {
  expect(ticketMessagesQueryKey(undefined)).toEqual(['feedback', 'ticket', undefined, 'messages']);
  await renderHook(() => useTicketMessages(undefined));
  const disabledQuery = mockUseQuery.mock.calls.at(-1)?.[0] as { enabled: boolean } | undefined;
  expect(disabledQuery?.enabled).toBe(false);

  mockOrder.mockResolvedValueOnce({ data: null, error: null });
  await renderHook(() => useTicketMessages('ticket-1'));
  const options = mockUseQuery.mock.calls.at(-1)?.[0] as {
    enabled: boolean;
    queryFn: () => Promise<FeedbackMessage[]>;
  };
  expect(options.enabled).toBe(true);
  await expect(options.queryFn()).resolves.toEqual([]);
  expect(mockEq).toHaveBeenCalledWith('ticket_id', 'ticket-1');
  expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });

  mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'message query failed' } });
  await expect(options.queryFn()).rejects.toThrow('message query failed');
});

it('haengt eine Nutzer-Antwort an den Thread an', async () => {
  mockSingle.mockResolvedValueOnce({
    data: { id: 'msg-2', ticket_id: 'ticket-1', author_type: 'user', body: 'Noch ein Hinweis.' },
    error: null,
  });

  const message = await sendReply({
    ticketId: 'ticket-1',
    userId: 'user-1',
    body: 'Noch ein Hinweis.',
  });

  expect(mockFrom).toHaveBeenCalledWith('feedback_messages');
  expect(mockInsert).toHaveBeenCalledWith({
    ticket_id: 'ticket-1',
    author_type: 'user',
    author_id: 'user-1',
    body: 'Noch ein Hinweis.',
  });
  expect(message).toEqual({
    id: 'msg-2',
    ticket_id: 'ticket-1',
    author_type: 'user',
    body: 'Noch ein Hinweis.',
  });
});

it('wirft die RLS-Fehlermeldung, wenn auf ein geschlossenes Ticket geantwortet wird', async () => {
  mockSingle.mockResolvedValueOnce({
    data: null,
    error: { message: 'new row violates row-level security policy for table "feedback_messages"' },
  });

  await expect(
    sendReply({ ticketId: 'ticket-1', userId: 'user-1', body: 'zu spaet' }),
  ).rejects.toThrow('row-level security policy');
});

it('weist eine Antwort ohne Text vor dem Insert zurueck', async () => {
  await expect(
    sendReply({ ticketId: 'ticket-1', userId: 'user-1', body: '   ' }),
  ).rejects.toThrow();
  expect(mockFrom).not.toHaveBeenCalled();
});

it('invalidiert nach einer neuen Ticket-Nachricht die passende Ticket-Liste', async () => {
  const input: CreateTicketInput = {
    userId: 'user-1',
    type: 'bug',
    subject: 'Titel',
    body: 'Text',
  };
  await renderHook(() => useCreateTicketMutation());
  const options = mockUseMutation.mock.calls.at(-1)?.[0] as {
    mutationFn: (variables: CreateTicketInput) => Promise<FeedbackTicket>;
    onSuccess: (_data: FeedbackTicket, variables: CreateTicketInput) => void;
  };

  const ticket = await options.mutationFn(input);
  options.onSuccess(ticket, input);
  expect(mockInvalidateQueries).toHaveBeenCalledWith({
    queryKey: myTicketsQueryKey('user-1'),
  });
});

it('invalidiert nach einer Nutzer-Antwort den passenden Nachrichten-Thread', async () => {
  const input: SendReplyInput = { ticketId: 'ticket-1', userId: 'user-1', body: 'Antwort' };
  mockSingle.mockResolvedValueOnce({
    data: { id: 'msg-3', ticket_id: 'ticket-1', author_type: 'user', body: 'Antwort' },
    error: null,
  });
  await renderHook(() => useSendReplyMutation());
  const options = mockUseMutation.mock.calls.at(-1)?.[0] as {
    mutationFn: (variables: SendReplyInput) => Promise<unknown>;
    onSuccess: (_data: unknown, variables: SendReplyInput) => void;
  };

  const message = await options.mutationFn(input);
  options.onSuccess(message, input);
  expect(mockInvalidateQueries).toHaveBeenCalledWith({
    queryKey: ticketMessagesQueryKey('ticket-1'),
  });
});
