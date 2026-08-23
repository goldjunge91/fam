-- Gewuenschter Endzustand — NICHT von Hand migrieren.
-- Profile sind 1:1 an auth.users gebunden und fuer Haushaltsmitglieder unsichtbar.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  birth_date date,

  -- Berechnungsbasis fuer BMR-Formeln, nicht die Geschlechtsidentitaet.
  -- Nullable erlaubt ein manuell gesetztes Kalorienziel.
  sex text check (sex in ('male', 'female')),

  height_cm numeric(5, 1) check (height_cm > 0 and height_cm < 300),
  activity_level text check (
    activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  ),

  onboarding_completed_at timestamptz,

  -- Defaults bewahren fuer bestehende Nutzer alle Module als aktiv.
  module_fridge boolean not null default true,
  module_shopping_list boolean not null default true,
  module_calories boolean not null default true,
  module_recipes boolean not null default true,
  module_meal_planner boolean not null default true,

  tracking_method text not null default 'standard' check (
    tracking_method in ('standard', 'glp1', 'fasting', 'keto', 'low_carb', 'workouts', 'cgm', 'volumetrics')
  ),

  tracking_day_start_time text not null default '00:00' check (tracking_day_start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Stammdaten pro Account. Streng privat — kein Zugriff durch Haushaltsmitglieder.';
comment on column public.profiles.sex is
  'Berechnungsbasis fuer Grundumsatz-Formeln, nicht die Geschlechtsidentitaet.';

create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function private.set_updated_at();

-- Der Trigger verhindert auth.users-Eintraege ohne zugehoeriges Profil.
-- Der leere search_path schuetzt SECURITY DEFINER vor manipulierten Suchpfaden.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Beim E-Mail-Signup dient der lokale Adressteil als editierbarer Startwert.
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

alter table public.profiles enable row level security;

-- Profile werden nur ueber die auth.users-Kaskade geloescht.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
