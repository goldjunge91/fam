-- profiles: 1:1 zu auth.users, plus die Stammdaten, die #81 (Grundumsatz) braucht.
--
-- Konventionen fuer alle Migrationen dieses Projekts:
--   * text statt varchar(n), timestamptz statt timestamp, numeric statt float
--   * Fremdschluesselspalten werden immer indiziert (Postgres tut das nicht selbst)
--   * RLS-Policies wrappen auth.uid() in (select ...), sonst wird die Funktion
--     pro Zeile statt einmal ausgewertet
--   * SECURITY-DEFINER-Helfer liegen im Schema `private`, nicht in `public`,
--     damit PostgREST sie nicht als RPC exponiert

-- ---------------------------------------------------------------- private schema
-- Sammelort fuer SECURITY-DEFINER-Helfer. Bewusst nicht `public`: alles in
-- `public` ist ueber PostgREST als RPC aufrufbar, und eine Funktion, die RLS
-- umgeht, hat dort nichts verloren.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ----------------------------------------------------------------------- table
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  birth_date date,

  -- Rechnerische Basis fuer Mifflin-St-Jeor / Harris-Benedict (#81), NICHT die
  -- Geschlechtsidentitaet des Nutzers. Beide Formeln kennen nur zwei Auspraegungen;
  -- wer hier nichts angibt, bekommt kein geschaetztes Kalorienziel, sondern setzt
  -- es in #84 manuell. Bewusst nullable.
  sex text check (sex in ('male', 'female')),

  height_cm numeric(5, 1) check (height_cm > 0 and height_cm < 300),
  activity_level text check (
    activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Stammdaten pro Account. Streng privat — kein Zugriff durch Haushaltsmitglieder.';
comment on column public.profiles.sex is
  'Berechnungsbasis fuer Grundumsatz-Formeln, nicht die Geschlechtsidentitaet.';

-- ------------------------------------------------------------------ updated_at
-- Wird ab #42 von allen synchronisierten Tabellen gebraucht; hier schon angelegt,
-- damit es nur eine Implementierung gibt.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function private.set_updated_at();

-- --------------------------------------------------------- auth.users -> profile
-- Ohne diesen Trigger muesste der Client das Profil nachtraeglich anlegen. Bricht
-- der Nutzer das Onboarding dann ab, bleibt ein auth.users-Eintrag ohne Profil
-- zurueck — ein Zustand, den danach jede Query beruecksichtigen muesste.
--
-- search_path = '' zwingt zur vollen Qualifizierung. Das ist bei SECURITY DEFINER
-- kein Stil, sondern Pflicht: sonst laesst sich ueber einen manipulierten
-- Suchpfad fremder Code unter den Rechten des Eigentuemers ausfuehren.
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
    -- Beim E-Mail-Signup ist noch kein Name bekannt; der lokale Teil der Adresse
    -- ist ein brauchbarer Startwert, den der Nutzer in #57 ueberschreibt.
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
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
