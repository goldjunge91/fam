-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- Blutzucker/CGM (#177) & Keton-Logs (#176).
--
-- Streng privat: Kein Zugriff durch Haushaltsmitglieder.

-- ---------------------------------------------------------------- Blutzucker
create table if not exists public.glucose_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  child_profile_id uuid references public.child_profiles (id) on delete cascade,

  measured_at timestamptz not null default now(),
  glucose_value numeric(5, 1) not null check (glucose_value > 0 and glucose_value < 1000),
  unit text not null default 'mg_dl' check (unit in ('mg_dl', 'mmol_l')),

  context text check (
    context in ('fasting', 'morning_fasting', 'pre_meal', 'post_meal_1h', 'post_meal_2h', 'bedtime', 'other')
  ),
  food_entry_id uuid references public.food_entries (id) on delete set null,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.glucose_entries is
  'Streng privat pro Account. Manuelle Glukosemessungen und CGM-Logs.';

create index if not exists glucose_entries_user_measured_idx
  on public.glucose_entries (user_id, measured_at desc)
  where deleted_at is null;
create index if not exists glucose_entries_child_id_idx
  on public.glucose_entries (child_profile_id);
create index if not exists glucose_entries_food_entry_id_idx
  on public.glucose_entries (food_entry_id);

create or replace trigger glucose_entries_set_updated_at
  before update on public.glucose_entries
  for each row
  execute function private.set_updated_at();

-- --------------------------------------------------------------------- Ketone
create table if not exists public.ketone_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  child_profile_id uuid references public.child_profiles (id) on delete cascade,

  measured_at timestamptz not null default now(),
  ketone_value numeric(5, 2) not null check (ketone_value >= 0 and ketone_value < 100),
  unit text not null default 'mmol_l' check (unit in ('mmol_l', 'ppm', 'mg_dl', 'level')),
  source text not null default 'blood' check (source in ('blood', 'breath', 'urine')),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.ketone_entries is
  'Streng privat pro Account. Keton-Messwerte fuer Low-Carb und Ketose-Tracking.';

create index if not exists ketone_entries_user_measured_idx
  on public.ketone_entries (user_id, measured_at desc)
  where deleted_at is null;
create index if not exists ketone_entries_child_id_idx
  on public.ketone_entries (child_profile_id);

create or replace trigger ketone_entries_set_updated_at
  before update on public.ketone_entries
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------------------------- RLS
alter table public.glucose_entries enable row level security;
alter table public.ketone_entries enable row level security;

create policy glucose_entries_own on public.glucose_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy ketone_entries_own on public.ketone_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
