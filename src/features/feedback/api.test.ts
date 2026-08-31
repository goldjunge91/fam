import { getSupabase } from '@/lib/supabase';
import { createTicket, myTicketsQueryKey, sendReply, ticketMessagesQueryKey } from './api';

const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockInsert = jest.fn();
const mockOrder = jest.fn();
const mockEq = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
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

it('wirft die Postgres-Fehlermeldung, wenn der Ticket-Insert fehlschlaegt', async () => {
  mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } });

  await expect(
    createTicket({ userId: 'user-1', type: 'bug', subject: 'x', body: 'y' }),
  ).rejects.toThrow('permission denied');
});

it('trennt Thread-Abfragen nach Ticket', () => {
  expect(ticketMessagesQueryKey('ticket-1')).toEqual([
    'feedback',
    'ticket',
    'ticket-1',
    'messages',
  ]);
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
