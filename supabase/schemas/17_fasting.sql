-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- Intervallfasten (#18): Protokolle, persistierter Timer-Start, Restzeit-Berechnung.
--
-- Streng privat: Kein Zugriff durch Haushaltsmitglieder.

create table if not exists public.fasting_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  child_profile_id uuid references public.child_profiles (id) on delete cascade,

  protocol text not null default '16:8'
    check (protocol in ('16:8', '18:6', '20:4', '5:2', 'omad', 'custom')),

  started_at timestamptz not null default now(),
  target_duration_minutes integer not null check (target_duration_minutes > 0),
  ended_at timestamptz,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.fasting_sessions is
  'Streng privat pro Account. Aufgezeichnete Fastenfenster und Zielzeiten.';

create index if not exists fasting_sessions_user_start_idx
  on public.fasting_sessions (user_id, started_at desc)
  where deleted_at is null;
create index if not exists fasting_sessions_child_id_idx
  on public.fasting_sessions (child_profile_id);

create or replace trigger fasting_sessions_set_updated_at
  before update on public.fasting_sessions
  for each row
  execute function private.set_updated_at();

-- ----------------------------------------------- Kind-Zuordnung absichern (#190)
-- Ein gesetztes child_profile_id muss zu einem Haushalt des user_id gehoeren.
-- Funktion siehe supabase/schemas/09_tracking.sql.
create or replace trigger fasting_sessions_check_child_household
  before insert or update on public.fasting_sessions
  for each row
  execute function private.check_tracking_child_household();

-- ------------------------------------------------------------------------- RLS
alter table public.fasting_sessions enable row level security;

create policy fasting_sessions_own on public.fasting_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
