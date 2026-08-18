-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- Medikations- & Symptom-Tracking (#174): Spezifisch fuer GLP-1 Injektionen /
-- Medikamente und deren Begleiterscheinungen (Appetit, Saettigung, Uebelkeit).
--
-- Streng privat: Kein Zugriff durch Haushaltsmitglieder.

-- ------------------------------------------------------------ Medikations-Log
create table if not exists public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  child_profile_id uuid references public.child_profiles (id) on delete cascade,

  medication_name text not null check (length(trim(medication_name)) between 1 and 200),
  dose numeric(7, 2) check (dose > 0),
  unit text not null default 'mg'
    check (unit in ('mg', 'ml', 'units', 'mcg', 'pills')),

  administered_at timestamptz not null default now(),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.medication_logs is
  'Streng privat pro Account. Protokollierung von Medikamenten/GLP-1 Injektionen.';

create index if not exists medication_logs_user_admin_idx
  on public.medication_logs (user_id, administered_at desc)
  where deleted_at is null;
create index if not exists medication_logs_child_id_idx
  on public.medication_logs (child_profile_id);

create or replace trigger medication_logs_set_updated_at
  before update on public.medication_logs
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------- Symptom-Log
create table if not exists public.symptom_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  child_profile_id uuid references public.child_profiles (id) on delete cascade,

  logged_at timestamptz not null default now(),

  appetite_level integer check (appetite_level between 1 and 5),
  satiety_level integer check (satiety_level between 1 and 5),
  nausea_level integer check (nausea_level between 0 and 5),
  side_effects text[] not null default '{}',
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.symptom_logs is
  'Streng privat pro Account. Verlauf von Appetit, Saettigung und Nebenwirkungen.';

create index if not exists symptom_logs_user_logged_idx
  on public.symptom_logs (user_id, logged_at desc)
  where deleted_at is null;
create index if not exists symptom_logs_child_id_idx
  on public.symptom_logs (child_profile_id);

create or replace trigger symptom_logs_set_updated_at
  before update on public.symptom_logs
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------------------------- RLS
alter table public.medication_logs enable row level security;
alter table public.symptom_logs enable row level security;

create policy medication_logs_own on public.medication_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy symptom_logs_own on public.symptom_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
