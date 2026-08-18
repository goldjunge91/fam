-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- profiles: 1:1 zu auth.users, plus die Stammdaten, die #81 (Grundumsatz)
-- braucht. Streng privat: kein Zugriff durch Haushaltsmitglieder.
--
-- Konventionen fuer alle Tabellen dieses Projekts:
--   * text statt varchar(n), timestamptz statt timestamp, numeric statt float
--   * Fremdschluesselspalten werden immer indiziert (Postgres tut das nicht selbst)
--   * RLS-Policies wrappen auth.uid() in (select ...), sonst wird die Funktion
--     pro Zeile statt einmal ausgewertet

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  birth_date date,

  -- Rechnerische Basis fuer Mifflin-St-Jeor / Harris-Benedict (#81), NICHT die
  -- Geschlechtsidentitaet des Nutzers. Beide Formeln kennen nur zwei
  -- Auspraegungen; wer hier nichts angibt, bekommt kein geschaetztes
  -- Kalorienziel, sondern setzt es in #84 manuell. Bewusst nullable.
  sex text check (sex in ('male', 'female')),

  height_cm numeric(5, 1) check (height_cm > 0 and height_cm < 300),
  activity_level text check (
    activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  ),

  onboarding_completed_at timestamptz,

  -- Modul-Aktivierung (#95): welche Bereiche der Nutzer im Onboarding
  -- ausgewaehlt hat. Default true, damit ein Nutzer ohne bewusste Wahl
  -- (z. B. alte Sessions vor #95) alles wie bisher sieht. Dashboard und
  -- Einstellungen sind laut docs/VISION.md bewusst nicht abwaehlbar und
  -- brauchen deshalb keine eigene Spalte.
  module_fridge boolean not null default true,
  module_shopping_list boolean not null default true,
  module_calories boolean not null default true,
  module_recipes boolean not null default true,
  module_meal_planner boolean not null default true,
  module_glp1 boolean not null default true,
  module_fasting boolean not null default true,
  module_workouts boolean not null default true,
  module_keto boolean not null default true,
  module_cgm boolean not null default true,
  module_volumetrics boolean not null default true,

  -- Individualisierbare Tages-Zeitfenster (#174): Startzeitpunkt des Nutzertags (Standard 00:00).
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

-- --------------------------------------------------------- auth.users -> profile
-- Ohne diesen Trigger muesste der Client das Profil nachtraeglich anlegen.
-- Bricht der Nutzer das Onboarding dann ab, bleibt ein auth.users-Eintrag ohne
-- Profil zurueck — ein Zustand, den danach jede Query beruecksichtigen muesste.
--
-- search_path = '' zwingt zur vollen Qualifizierung. Das ist bei SECURITY
-- DEFINER kein Stil, sondern Pflicht: sonst laesst sich ueber einen
-- manipulierten Suchpfad fremder Code unter den Rechten des Eigentuemers
-- ausfuehren.
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
    -- Beim E-Mail-Signup ist noch kein Name bekannt; der lokale Teil der
    -- Adresse ist ein brauchbarer Startwert, den der Nutzer in #57 ueberschreibt.
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

-- ------------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;

-- Kein DELETE: Profile verschwinden ausschliesslich ueber die Kaskade von
-- auth.users (#98). Eine DELETE-Policy waere ein zweiter, unnoetiger Weg,
-- Daten zu verlieren.
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
