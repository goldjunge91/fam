-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.feedback_messages (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  ticket_id   uuid                     NOT NULL,
  author_type text                     NOT NULL,
  author_id   uuid,
  body        text                     NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.feedback_messages IS 'Thread je Ticket, erste Zeile ist die initiale Nutzer-Nachricht. staff-Zeilen nur ueber service_role.';

ALTER TABLE public.feedback_messages
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feedback_messages
  REPLICA IDENTITY FULL;

ALTER TABLE public.feedback_messages
  ADD CONSTRAINT feedback_messages_author_check CHECK (author_type = 'user'::text AND author_id IS NOT NULL OR author_type = 'staff'::text);

ALTER TABLE public.feedback_messages
  ADD CONSTRAINT feedback_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.feedback_messages
  ADD CONSTRAINT feedback_messages_author_type_check CHECK (author_type = ANY (ARRAY['user'::text, 'staff'::text]));

ALTER TABLE public.feedback_messages
  ADD CONSTRAINT feedback_messages_body_check CHECK (length(TRIM(BOTH FROM body)) >= 1 AND length(TRIM(BOTH FROM body)) <= 4000);

ALTER TABLE public.feedback_messages
  ADD CONSTRAINT feedback_messages_pkey PRIMARY KEY (id);

GRANT INSERT, SELECT ON public.feedback_messages TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.feedback_messages TO service_role;

CREATE INDEX feedback_messages_ticket_id_idx ON public.feedback_messages (ticket_id, created_at);

CREATE TABLE public.feedback_tickets (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  ticket_number bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id       uuid                     NOT NULL,
  type          text                     NOT NULL,
  subject       text                     NOT NULL,
  status        text                     DEFAULT 'open'::text NOT NULL,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_messages, TABLE public.feedback_tickets;

CREATE POLICY feedback_messages_insert_own ON public.feedback_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (((author_type = 'user'::text) AND (author_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.feedback_tickets ticket
  WHERE ((ticket.id = feedback_messages.ticket_id) AND (ticket.user_id = ( SELECT auth.uid() AS uid)) AND (ticket.status <> 'closed'::text))))));

CREATE POLICY feedback_messages_select_own ON public.feedback_messages
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.feedback_tickets ticket
  WHERE ((ticket.id = feedback_messages.ticket_id) AND (ticket.user_id = ( SELECT auth.uid() AS uid))))));

COMMENT ON TABLE public.feedback_tickets IS 'Nutzer-Feedback (Anregung/Fehler/Sonstiges) mit Status-Verlauf. Statuswechsel nur ueber service_role.';

ALTER TABLE public.feedback_tickets
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feedback_tickets
  REPLICA IDENTITY FULL;

ALTER TABLE public.feedback_tickets
  ADD CONSTRAINT feedback_tickets_pkey PRIMARY KEY (id);

ALTER TABLE public.feedback_messages
  ADD CONSTRAINT feedback_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.feedback_tickets(id) ON DELETE CASCADE;

ALTER TABLE public.feedback_tickets
  ADD CONSTRAINT feedback_tickets_status_check CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'answered'::text, 'closed'::text]));

ALTER TABLE public.feedback_tickets
  ADD CONSTRAINT feedback_tickets_subject_check CHECK (length(TRIM(BOTH FROM subject)) >= 1 AND length(TRIM(BOTH FROM subject)) <= 200);

ALTER TABLE public.feedback_tickets
  ADD CONSTRAINT feedback_tickets_type_check CHECK (type = ANY (ARRAY['bug'::text, 'suggestion'::text, 'other'::text]));

ALTER TABLE public.feedback_tickets
  ADD CONSTRAINT feedback_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT INSERT, SELECT ON public.feedback_tickets TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.feedback_tickets TO service_role;

CREATE UNIQUE INDEX feedback_tickets_ticket_number_idx ON public.feedback_tickets (ticket_number);

CREATE INDEX feedback_tickets_user_id_idx ON public.feedback_tickets (user_id);

CREATE TRIGGER feedback_tickets_set_updated_at
  BEFORE UPDATE ON public.feedback_tickets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY feedback_tickets_insert_own ON public.feedback_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY feedback_tickets_select_own ON public.feedback_tickets
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));