-- Gewuenschter Endzustand — NICHT von Hand migrieren (#347).
--
-- Nutzer-Feedback: Anregungen, Fehler oder Sonstiges, mit sichtbarer
-- Ticket-Nummer und Status-Verlauf. Kein Haushaltsbezug — haengt nur am
-- einreichenden Nutzer.
--
-- Statuswechsel und staff-Antworten sind bewusst nicht ueber `authenticated`
-- schreibbar: In v1 pflegen Devs Tickets ueber Supabase Studio bzw.
-- `service_role`, es gibt noch keine Staff-Rolle in der DB. Das Schema ist
-- trotzdem als Thread normalisiert (feedback_messages statt einem Freitext-
-- feld auf dem Ticket), damit eine spaetere Website-Anbindung ohne
-- Schema-Bruch andocken kann.

create table if not exists public.feedback_tickets (
  id uuid primary key default gen_random_uuid(),

  -- Fortlaufende, fuer Nutzer sichtbare Ticket-Nummer (z. B. "#142") —
  -- getrennt von der uuid, die intern als Fremdschluessel dient.
  ticket_number bigint generated always as identity,

  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('bug', 'suggestion', 'other')),
  subject text not null check (length(trim(subject)) between 1 and 200),
  status text not null default 'open' check (status in ('open', 'in_progress', 'answered', 'closed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists feedback_tickets_ticket_number_idx
  on public.feedback_tickets (ticket_number);
create index if not exists feedback_tickets_user_id_idx
  on public.feedback_tickets (user_id);

comment on table public.feedback_tickets is
  'Nutzer-Feedback (Anregung/Fehler/Sonstiges) mit Status-Verlauf. Statuswechsel nur ueber service_role.';

create or replace trigger feedback_tickets_set_updated_at
  before update on public.feedback_tickets
  for each row
  execute function private.set_updated_at();

-- Thread je Ticket. Die initiale Nutzer-Nachricht ist die erste Zeile hier,
-- kein separates Freitextfeld auf feedback_tickets.
create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.feedback_tickets (id) on delete cascade,
  author_type text not null check (author_type in ('user', 'staff')),

  -- Bei author_type = 'staff' i. d. R. null, solange keine Staff-Accounts
  -- existieren (Antworten laufen ueber service_role, nicht ueber ein Login).
  author_id uuid references public.profiles (id) on delete set null,

  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),

  constraint feedback_messages_author_check check (
    (author_type = 'user' and author_id is not null)
    or (author_type = 'staff')
  )
);

create index if not exists feedback_messages_ticket_id_idx
  on public.feedback_messages (ticket_id, created_at);

comment on table public.feedback_messages is
  'Thread je Ticket, erste Zeile ist die initiale Nutzer-Nachricht. staff-Zeilen nur ueber service_role.';

-- ------------------------------------------------------------------------- RLS
alter table public.feedback_tickets enable row level security;

create policy feedback_tickets_select_own on public.feedback_tickets
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy feedback_tickets_insert_own on public.feedback_tickets
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Bewusst kein update/delete fuer authenticated: auch das Schliessen eines
-- eigenen Tickets passiert ausschliesslich ueber service_role (siehe
-- Dateikopf).

alter table public.feedback_messages enable row level security;

create policy feedback_messages_select_own on public.feedback_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.feedback_tickets ticket
      where ticket.id = feedback_messages.ticket_id
        and ticket.user_id = (select auth.uid())
    )
  );

create policy feedback_messages_insert_own on public.feedback_messages
  for insert to authenticated
  with check (
    author_type = 'user'
    and author_id = (select auth.uid())
    and exists (
      select 1 from public.feedback_tickets ticket
      where ticket.id = feedback_messages.ticket_id
        and ticket.user_id = (select auth.uid())
        and ticket.status <> 'closed'
    )
  );
