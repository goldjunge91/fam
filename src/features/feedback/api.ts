import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

// Generierte Row-Typen kennen `type`/`status` nur als `string` — Postgres-Check-
// Constraints werden nicht als TS-Union exportiert. Deshalb hier eigene Literal-
// Unions, passend zu den `check`-Constraints in supabase/schemas/24_feedback.sql.
export type FeedbackType = 'bug' | 'suggestion' | 'other';
export type FeedbackStatus = 'open' | 'in_progress' | 'answered' | 'closed';

export type FeedbackTicket = Omit<
  Database['public']['Tables']['feedback_tickets']['Row'],
  'type' | 'status'
> & { type: FeedbackType; status: FeedbackStatus };
export type FeedbackMessage = Database['public']['Tables']['feedback_messages']['Row'];

// ------------------------------------------------------------------ Tickets

export function myTicketsQueryKey(userId: string | undefined) {
  return ['feedback', 'tickets', userId] as const;
}

export function useMyTickets(userId: string | undefined) {
  return useQuery({
    queryKey: myTicketsQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('feedback_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      // Siehe Kommentar bei FeedbackTicket: type/status kommen aus dem
      // generierten Row-Typ nur als `string`.
      return (data ?? []) as FeedbackTicket[];
    },
    enabled: !!userId,
  });
}

const createTicketInputSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(['bug', 'suggestion', 'other']),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
});

export type CreateTicketInput = z.input<typeof createTicketInputSchema>;

/** Legt ein Ticket samt initialer Nachricht an. Kein RPC noetig — beide Inserts sind durch RLS auf denselben Nutzer beschraenkt. */
export async function createTicket(input: CreateTicketInput): Promise<FeedbackTicket> {
  const validated = createTicketInputSchema.parse(input);
  const supabase = getSupabase();

  const { data: ticket, error: ticketError } = await supabase
    .from('feedback_tickets')
    .insert({ user_id: validated.userId, type: validated.type, subject: validated.subject })
    .select('*')
    .single();

  if (ticketError) throw new Error(ticketError.message);

  const { error: messageError } = await supabase.from('feedback_messages').insert({
    ticket_id: ticket.id,
    author_type: 'user',
    author_id: validated.userId,
    body: validated.body,
  });

  if (messageError) throw new Error(messageError.message);

  // Die generierten Row-Typen kennen `type`/`status` nur als `string` (siehe
  // Kommentar oben); der Datenbank-Check-Constraint garantiert die Literale.
  return ticket as FeedbackTicket;
}

export function useCreateTicketMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTicket,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: myTicketsQueryKey(variables.userId) });
    },
  });
}

export function ticketQueryKey(ticketId: string | undefined) {
  return ['feedback', 'ticket', ticketId] as const;
}

export function useTicket(ticketId: string | undefined) {
  return useQuery({
    queryKey: ticketQueryKey(ticketId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('feedback_tickets')
        .select('*')
        .eq('id', ticketId as string)
        .single();

      if (error) throw new Error(error.message);
      return data as FeedbackTicket;
    },
    enabled: !!ticketId,
  });
}

// ----------------------------------------------------------------- Nachrichten

export function ticketMessagesQueryKey(ticketId: string | undefined) {
  return ['feedback', 'ticket', ticketId, 'messages'] as const;
}

export function useTicketMessages(ticketId: string | undefined) {
  return useQuery({
    queryKey: ticketMessagesQueryKey(ticketId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('feedback_messages')
        .select('*')
        .eq('ticket_id', ticketId as string)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!ticketId,
  });
}

const sendReplyInputSchema = z.object({
  ticketId: z.string().min(1),
  userId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
});

export type SendReplyInput = z.input<typeof sendReplyInputSchema>;

/** Antwort eines Nutzers auf sein eigenes Ticket. RLS lehnt das ab, sobald das Ticket `closed` ist. */
export async function sendReply(input: SendReplyInput): Promise<FeedbackMessage> {
  const validated = sendReplyInputSchema.parse(input);

  const { data, error } = await getSupabase()
    .from('feedback_messages')
    .insert({
      ticket_id: validated.ticketId,
      author_type: 'user',
      author_id: validated.userId,
      body: validated.body,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export function useSendReplyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendReply,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ticketMessagesQueryKey(variables.ticketId) });
    },
  });
}
