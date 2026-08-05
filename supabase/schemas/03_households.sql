-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- Hier entscheidet sich, wer welche Daten sieht. Der Haushalt ist die Grenze
-- zwischen "geteilt" (Vorrat, Einkaufsliste) und "privat" (Kalorien, Gewicht).

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- UUID statt bigint identity, obwohl UUIDv4 die Index-Lokalitaet
-- verschlechtert: Die App legt Datensaetze offline an (#46) und muss die ID
-- dabei selbst vergeben. Bei einer serverseitigen Sequenz ginge das nicht.
create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Der Primaerschluessel deckt (household_id, user_id) ab und damit jede Suche,
-- die mit household_id beginnt. Die Gegenrichtung "alle Haushalte eines
-- Nutzers" braucht einen eigenen Index — genau die Query laeuft beim App-Start.
create index if not exists household_members_user_id_idx
  on public.household_members (user_id);
create index if not exists households_created_by_idx
  on public.households (created_by);

create or replace trigger households_set_updated_at
  before update on public.households
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------ Zugehoerigkeits-Helfer
--
-- Der eigentliche Fallstrick des Datenmodells:
--
-- Eine Policy auf household_members, die zur Pruefung einer Zeile wieder
-- household_members abfragt ("darf ich diese Zeile sehen? -> bin ich Mitglied
-- dieses Haushalts? -> SELECT auf household_members"), bricht Postgres mit
-- `infinite recursion detected in policy for relation "household_members"` ab.
--
-- SECURITY DEFINER umgeht RLS innerhalb der Funktion und durchbricht den Kreis.

create or replace function private.is_household_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.is_household_admin(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- ACHTUNG: Die Rechte fuer diese Funktionen stehen NICHT hier, sondern in
-- supabase/migrations/*_privileges.sql. `supabase db diff` erfasst
-- Schema-Privilegien und Funktions-Grants nicht — hier notiert waeren sie
-- wirkungslos und wuerden einen Zustand behaupten, den die Datenbank nicht hat.

-- ------------------------------------------------------------- Haushalt anlegen
-- Als RPC, nicht als INSERT aus dem Client: Haushalt und Admin-Mitgliedschaft
-- muessen zusammen entstehen. Ein Abbruch dazwischen hinterliesse einen
-- Haushalt ohne Admin, den danach niemand mehr verwalten koennte.
create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  insert into public.households (name, created_by)
  values (household_name, uid)
  returning id into new_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_id, uid, 'admin');

  return new_id;
end;
$$;

-- Rechte fuer dieses RPC: siehe migrations/*_privileges.sql.

-- ------------------------------------------------------- letzter Admin absichern
-- Ohne diese Sperre kann sich der letzte Admin degradieren oder austragen und
-- laesst einen Haushalt zurueck, den niemand mehr verwalten kann — inklusive
-- der Daten aller anderen Mitglieder.
create or replace function private.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_admin boolean;
  remaining integer;
begin
  removed_admin := (tg_op = 'DELETE' and old.role = 'admin')
    or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin');

  if not removed_admin then
    return coalesce(new, old);
  end if;

  select count(*) into remaining
  from public.household_members
  where household_id = old.household_id
    and role = 'admin'
    and user_id <> old.user_id;

  if remaining = 0 then
    raise exception 'Der letzte Administrator kann den Haushalt nicht verlassen. Ernenne zuerst jemand anderen.';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace trigger household_members_guard_last_admin
  before update or delete on public.household_members
  for each row
  execute function private.guard_last_admin();

-- ------------------------------------------------------------------------- RLS
alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- households: sichtbar fuer Mitglieder, aenderbar nur durch Admins.
-- Kein INSERT: Haushalte entstehen ausschliesslich ueber create_household().
create policy households_select_member on public.households
  for select to authenticated
  using ((select private.is_household_member(id)));

create policy households_update_admin on public.households
  for update to authenticated
  using ((select private.is_household_admin(id)))
  with check ((select private.is_household_admin(id)));

create policy households_delete_admin on public.households
  for delete to authenticated
  using ((select private.is_household_admin(id)));

-- household_members: Mitglieder sehen die Mitgliederliste ihrer Haushalte.
-- Der Aufruf laeuft ueber die SECURITY-DEFINER-Funktion und nicht ueber eine
-- Subquery auf dieselbe Tabelle — siehe Kommentar oben.
create policy household_members_select on public.household_members
  for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy household_members_insert_admin on public.household_members
  for insert to authenticated
  with check ((select private.is_household_admin(household_id)));

create policy household_members_update_admin on public.household_members
  for update to authenticated
  using ((select private.is_household_admin(household_id)))
  with check ((select private.is_household_admin(household_id)));

-- Entfernen darf ein Admin — oder das Mitglied sich selbst (Haushalt verlassen).
create policy household_members_delete on public.household_members
  for delete to authenticated
  using (
    (select private.is_household_admin(household_id))
    or user_id = (select auth.uid())
  );
