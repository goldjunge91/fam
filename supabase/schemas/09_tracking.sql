-- Gewuenschter Endzustand — NICHT von Hand migrieren (#41).
--
-- Die Datenschutz-Kernzusage des Projekts: Kalorien, Gewicht, Koerpermasse und
-- Ziele bleiben pro Account privat und werden nicht mit dem Haushalt geteilt.
--
-- Das steht hier in den Policies und nicht in der UI. Eine Anzeige, die etwas
-- ausblendet, ist keine Zusicherung — sie ist eine Bitte.
--
-- Konkret: In diesen Tabellen kommt `is_household_member` NICHT vor. Selbst ein
-- Haushalts-Administrator hat keinen Zugriff.

-- ------------------------------------------------------------ Ernaehrungstagebuch
create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),

  -- Genau eine der beiden Zuordnungen: entweder ein eigener Account oder ein
  -- verwaltetes Kinder-Profil (#37). Der Check verhindert Eintraege, die zu
  -- beidem oder zu nichts gehoeren.
  user_id uuid not null references public.profiles (id) on delete cascade,
  child_profile_id uuid references public.child_profiles (id) on delete cascade,

  product_id uuid references public.products (id) on delete set null,

  -- Reines Kalenderdatum in der lokalen Zeitzone des Nutzers, kein Zeitstempel.
  -- Wer das als timestamptz fuehrt, sortiert abends geloggte Mahlzeiten in den
  -- Folgetag (#88).
  logged_on date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),

  quantity numeric(10, 3) not null check (quantity > 0),
  unit text not null default 'g'
    check (unit in ('g', 'kg', 'ml', 'l', 'piece', 'package', 'portion')),

  -- Denormalisiert, mit Absicht: Die Naehrwerte werden zum Zeitpunkt der
  -- Erfassung kopiert. Korrigiert jemand spaeter das Produkt, darf sich die
  -- Vergangenheit nicht rueckwirkend aendern — sonst stimmt keine Auswertung mehr.
  name text not null,
  kcal numeric(8, 2) check (kcal >= 0),
  protein_g numeric(7, 2) check (protein_g >= 0),
  carbs_g numeric(7, 2) check (carbs_g >= 0),
  fat_g numeric(7, 2) check (fat_g >= 0),
  fiber_g numeric(7, 2) check (fiber_g >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.food_entries is
  'Streng privat pro Account. Kein Zugriff durch Haushaltsmitglieder, auch nicht durch Admins.';

create index if not exists food_entries_user_day_idx
  on public.food_entries (user_id, logged_on)
  where deleted_at is null;
create index if not exists food_entries_child_day_idx
  on public.food_entries (child_profile_id, logged_on)
  where deleted_at is null and child_profile_id is not null;
create index if not exists food_entries_product_id_idx
  on public.food_entries (product_id);

create or replace trigger food_entries_set_updated_at
  before update on public.food_entries
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------------------- Gewicht
create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  child_profile_id uuid references public.child_profiles (id) on delete cascade,

  measured_on date not null default current_date,
  weight_kg numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 700),

  -- Koerpermasse in cm, alle optional.
  waist_cm numeric(5, 1) check (waist_cm > 0),
  chest_cm numeric(5, 1) check (chest_cm > 0),
  hip_cm numeric(5, 1) check (hip_cm > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.weight_entries is
  'Streng privat pro Account. Kein Zugriff durch Haushaltsmitglieder.';

create index if not exists weight_entries_user_day_idx
  on public.weight_entries (user_id, measured_on)
  where deleted_at is null;
create index if not exists weight_entries_child_id_idx
  on public.weight_entries (child_profile_id);

create or replace trigger weight_entries_set_updated_at
  before update on public.weight_entries
  for each row
  execute function private.set_updated_at();

-- --------------------------------------------------------------------- Ziele
create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  child_profile_id uuid references public.child_profiles (id) on delete cascade,

  goal_type text not null check (goal_type in ('lose', 'maintain', 'gain')),
  target_weight_kg numeric(5, 2) check (target_weight_kg > 0 and target_weight_kg < 700),

  -- 0,25 bis 1,0 kg pro Woche. Alles darueber ist weder gesund noch haltbar;
  -- die Grenze steht schon hier und nicht erst in der UI.
  rate_kg_per_week numeric(3, 2) check (rate_kg_per_week between 0 and 1),

  -- Untergrenze mit Ansage: Ein Kalorienziel unter 1000 ist fuer eine App, die
  -- Ernaehrung begleitet, kein sinnvoller Wert. Die eigentliche Kappung auf den
  -- Grundumsatz passiert in #82 — das hier ist die letzte Schranke.
  daily_kcal integer check (daily_kcal between 1000 and 10000),
  protein_g integer check (protein_g >= 0),
  carbs_g integer check (carbs_g >= 0),
  fat_g integer check (fat_g >= 0),

  -- Historisiert statt ueberschrieben: Aendert jemand sein Ziel, sollen
  -- vergangene Auswertungen weiter gegen das damalige Ziel laufen.
  valid_from date not null default current_date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.user_goals is
  'Streng privat pro Account. Historisiert ueber valid_from statt ueberschrieben.';

create index if not exists user_goals_user_valid_idx
  on public.user_goals (user_id, valid_from desc)
  where deleted_at is null;
create index if not exists user_goals_child_id_idx
  on public.user_goals (child_profile_id);

create or replace trigger user_goals_set_updated_at
  before update on public.user_goals
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------------------------- RLS
alter table public.food_entries enable row level security;
alter table public.weight_entries enable row level security;
alter table public.user_goals enable row level security;

-- Der entscheidende Unterschied zu allen Haushaltstabellen: Hier steht
-- ausschliesslich `auth.uid() = user_id`. Kein is_household_member, kein
-- is_household_admin. Wer den Haushalt verwaltet, sieht diese Daten trotzdem nicht.
create policy food_entries_own on public.food_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy weight_entries_own on public.weight_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy user_goals_own on public.user_goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
