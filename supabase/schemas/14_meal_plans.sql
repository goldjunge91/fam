-- Gewuenschter Endzustand — NICHT von Hand migrieren (#41, #123, #128).
-- Wochenplan-Eintraege ordnen Rezepte, Datum, Mahlzeit und Menge zu, nicht Personen.

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,

  name text not null check (length(trim(name)) between 1 and 120),
  -- Eintraege ausserhalb der Woche bleiben fuer flexible Verschiebungen erlaubt.
  week_start_date date not null,

  created_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.meal_plans is
  'Wochenplan, haushaltsweit geteilt (#128). Ein Eintrag pro Haushalt und Kalenderwoche, siehe meal_plans_household_week_unique.';

-- Pro Haushalt und Woche existiert hoechstens ein aktiver Plan.
create unique index if not exists meal_plans_household_week_unique
  on public.meal_plans (household_id, week_start_date)
  where deleted_at is null;

create index if not exists meal_plans_household_id_idx
  on public.meal_plans (household_id);
create index if not exists meal_plans_household_updated_idx
  on public.meal_plans (household_id, updated_at);

create or replace trigger meal_plans_set_updated_at
  before update on public.meal_plans
  for each row
  execute function private.set_updated_at();

create table if not exists public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  -- Denormalisiert fuer RLS und Sync-Index.
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,

  -- Kalenderdaten lassen sich beim Wiederverwenden direkt um sieben Tage verschieben.
  entry_date date not null,
  -- Der Wochenplan bildet nur die drei Hauptmahlzeiten ab.
  meal_slot text not null
    check (meal_slot in ('breakfast', 'lunch', 'dinner')),

  -- portions speichert in beiden Modi den kanonisch umgerechneten Wert.
  servings_mode text not null default 'portions'
    check (servings_mode in ('portions', 'people')),
  portions numeric(6, 2) not null check (portions > 0),
  -- Der Personenfaktor bleibt eine App-Einstellung, kein gespeicherter Planwert.
  people_count integer check (people_count > 0),

  created_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint meal_plan_entries_people_count_matches_mode
    check (
      (servings_mode = 'people' and people_count is not null)
      or (servings_mode = 'portions' and people_count is null)
    )
);

comment on table public.meal_plan_entries is
  'Ein Rezept an einem Tag/einer Mahlzeit eines Wochenplans (#128). Nur Mengen (portions/people_count), keine Zuordnung zu einzelnen Haushaltsmitgliedern.';

create index if not exists meal_plan_entries_meal_plan_id_idx
  on public.meal_plan_entries (meal_plan_id);
create index if not exists meal_plan_entries_recipe_id_idx
  on public.meal_plan_entries (recipe_id);
create index if not exists meal_plan_entries_entry_date_idx
  on public.meal_plan_entries (meal_plan_id, entry_date);
create index if not exists meal_plan_entries_household_updated_idx
  on public.meal_plan_entries (household_id, updated_at);

create or replace trigger meal_plan_entries_set_updated_at
  before update on public.meal_plan_entries
  for each row
  execute function private.set_updated_at();

alter table public.meal_plans enable row level security;
alter table public.meal_plan_entries enable row level security;

create policy meal_plans_household on public.meal_plans
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy meal_plan_entries_household on public.meal_plan_entries
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));
