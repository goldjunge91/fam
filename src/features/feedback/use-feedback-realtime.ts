import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { myTicketsQueryKey, ticketMessagesQueryKey, ticketQueryKey } from '@/features/feedback/api';
import { getSupabase } from '@/lib/supabase';

type FeedbackTicketRow = { id: string; status: string; user_id: string };
type FeedbackMessageRow = { id: string; ticket_id: string; author_type: string };

type UseFeedbackRealtimeOptions = {
  userId: string | undefined;
  /** Gesetzt auf dem Detail-Screen — grenzt ein, fuer welches Ticket neue staff-Nachrichten eine Meldung ausloesen. */
  ticketId?: string;
  onTicketInProgress?: (ticketId: string) => void;
  onStaffReply?: (ticketId: string) => void;
};

/**
 * Haelt Ticket-Liste/-Detail live: invalidiert den React-Query-Cache bei
 * Statuswechseln und neuen Thread-Nachrichten, solange die App offen ist.
 * Kein Server-Push — nur Supabase Realtime (siehe SPEC.md, v1-Entscheidung).
 *
 * `feedback_messages` hat keine `user_id`-Spalte, daher kein serverseitiger
 * Filter dafuer; die RLS-Policy aus 24_feedback.sql laesst ohnehin nur
 * Nachrichten zu eigenen Tickets durch.
 */
export function useFeedbackRealtime({
  userId,
  ticketId,
  onTicketInProgress,
  onStaffReply,
}: UseFeedbackRealtimeOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabase();
    const channel = supabase.channel(`feedback:${userId}`);

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'feedback_tickets',
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<FeedbackTicketRow>) => {
        const updated = payload.new as FeedbackTicketRow;
        const previous = payload.old as Partial<FeedbackTicketRow>;

        queryClient.invalidateQueries({ queryKey: myTicketsQueryKey(userId) });
        if (updated.id) {
          queryClient.invalidateQueries({ queryKey: ticketQueryKey(updated.id) });
        }

        if (updated.status === 'in_progress' && previous.status !== 'in_progress') {
          onTicketInProgress?.(updated.id);
        }
      },
    );

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'feedback_messages' },
      (payload: RealtimePostgresChangesPayload<FeedbackMessageRow>) => {
        const inserted = payload.new as FeedbackMessageRow;
        if (!inserted.ticket_id) return;

        queryClient.invalidateQueries({ queryKey: ticketMessagesQueryKey(inserted.ticket_id) });

        if (ticketId && inserted.ticket_id === ticketId && inserted.author_type === 'staff') {
          onStaffReply?.(inserted.ticket_id);
        }
      },
    );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, ticketId, onTicketInProgress, onStaffReply, queryClient]);
}
