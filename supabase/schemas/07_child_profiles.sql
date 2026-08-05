-- Gewuenschter Endzustand — NICHT von Hand migrieren (#37).
--
-- Vereinfachte Profile fuer Kinder ohne eigenen Account.
--
-- Designentscheidung mit Folgen: Kinder-Profile haengen am Haushalt, nicht an
-- auth.users. Alle Tracking-Tabellen brauchen deshalb ein optionales
-- child_profile_id als Alternative zu user_id (#41) — nachtraeglich waere das
-- eine schmerzhafte Migration.

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,

  -- Wer das Profil verwaltet. Verlaesst dieser Elternteil den Haushalt, faellt
  -- die Verwaltung an einen Admin zurueck (set null), statt das Profil und
  -- damit die Ernaehrungshistorie des Kindes zu loeschen.
  managed_by uuid references public.profiles (id) on delete set null,

  display_name text not null check (length(trim(display_name)) between 1 and 80),
  birth_date date,

  -- Wie bei profiles: Berechnungsbasis der BMR-Formeln, nicht die
  -- Geschlechtsidentitaet. Nullable.
  sex text check (sex in ('male', 'female')),
  height_cm numeric(5, 1) check (height_cm > 0 and height_cm < 300),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.child_profiles is
  'Profile ohne eigenen Auth-Account, verwaltet durch ein Haushaltsmitglied.';

create index if not exists child_profiles_household_id_idx
  on public.child_profiles (household_id);
create index if not exists child_profiles_managed_by_idx
  on public.child_profiles (managed_by);

create or replace trigger child_profiles_set_updated_at
  before update on public.child_profiles
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------------------------- RLS
alter table public.child_profiles enable row level security;

-- Sichtbar fuer alle Mitglieder: Wer kocht, muss wissen, fuer wen. Das ist eine
-- bewusste Ausnahme von der sonstigen Trennung — die Ernaehrungsdaten des
-- Kindes bleiben trotzdem in den privaten Tabellen (#41) geschuetzt.
create policy child_profiles_select_member on public.child_profiles
  for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy child_profiles_insert_member on public.child_profiles
  for insert to authenticated
  with check (
    (select private.is_household_member(household_id))
    and managed_by = (select auth.uid())
  );

-- Aendern und loeschen darf der Verwalter oder ein Admin. Nicht jedes Mitglied:
-- sonst koennte ein WG-Mitbewohner die Daten fremder Kinder veraendern.
create policy child_profiles_update_manager on public.child_profiles
  for update to authenticated
  using (
    managed_by = (select auth.uid())
    or (select private.is_household_admin(household_id))
  )
  with check (
    (select private.is_household_member(household_id))
  );

create policy child_profiles_delete_manager on public.child_profiles
  for delete to authenticated
  using (
    managed_by = (select auth.uid())
    or (select private.is_household_admin(household_id))
  );
