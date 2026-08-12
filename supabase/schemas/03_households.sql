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
-- `updated_at` ist hier kein Beiwerk, sondern Voraussetzung fuer Epic 2: Der
-- inkrementelle Pull der Sync-Engine fragt je Tabelle "was hat sich seit
-- lastSyncedAt geaendert". Mit nur `joined_at` waere ein Rollenwechsel oder das
-- Entfernen eines Mitglieds fuer diesen Pull unsichtbar — der lokale
-- Rechte-Cache liesse sich nie aktualisieren und ein entfernter Nutzer behielte
-- auf seinem Geraet Zugriffsrechte, die serverseitig laengst weg sind.
create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
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
-- `public.create_household()` ist als RPC gebaut, nicht als INSERT aus dem
-- Client: Haushalt und Admin-Mitgliedschaft muessen zusammen entstehen. Ein
-- Abbruch dazwischen hinterliesse einen Haushalt ohne Admin, den danach niemand
-- mehr verwalten koennte.
--
-- Die Definition steht bewusst NICHT hier, sondern in 08_inventory.sql: Dort
-- legt sie zusaetzlich die Standard-Lagerorte an und braucht deshalb die
-- storage_locations-Tabelle. Stuende hier eine zweite Fassung, gaebe es zwei
-- Definitionen derselben Funktion, von denen die spaetere still gewinnt —
-- und bei jeder Umsortierung von `schema_paths` kippte, welche das ist.
--
-- Rechte fuer dieses RPC: siehe 04_privileges.sql.

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

  -- Der ganze Haushalt wird gerade mitgeloescht (`delete from households`
  -- kaskadiert hierher): Bei `on delete cascade` ist die Elternzeile zum
  -- Zeitpunkt dieses Row-Triggers bereits weg (empirisch geprueft, nicht nur
  -- angenommen). Dann gibt es keinen Haushalt mehr, den ein fehlender Admin
  -- verwaisen liesse — die Sperre waere hier nur im Weg (#98/#64).
  if not exists (select 1 from public.households where id = old.household_id) then
    return coalesce(new, old);
  end if;

  -- Verbleiben nach dieser Aenderung ueberhaupt keine anderen Mitglieder mehr,
  -- gibt es ebenfalls niemanden, der ohne Admin zurueckbliebe — der Fall
  -- "letzter Admin verlaesst einen Haushalt, der dadurch leer wird" ist erlaubt,
  -- nur "anderen Mitgliedern den Admin entziehen" nicht.
  select count(*) into remaining
  from public.household_members
  where household_id = old.household_id
    and user_id <> old.user_id;

  if remaining = 0 then
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

-- Reihenfolge ist hier relevant: Postgres feuert BEFORE-Row-Trigger in
-- alphabetischer Reihenfolge ihres Namens. `..._guard_last_admin` laeuft also
-- vor `..._set_updated_at`. Der Waechter gibt `coalesce(new, old)` zurueck,
-- damit erreicht NEW den zweiten Trigger unveraendert.
create or replace trigger household_members_set_updated_at
  before update on public.household_members
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------- Kontoloeschung vorbereiten
-- `public.prepare_account_deletion()` (#98): raeumt Haushaltsbezuege des
-- aufrufenden Nutzers auf, BEVOR die Edge Function `delete-account` per
-- Admin-API `auth.users` loescht. Zwei Dinge wuerden sonst kaskadierend
-- blockieren:
--
-- 1. `households.created_by references profiles on delete restrict` — ein
--    Nutzer, der einen noch bestehenden Haushalt erstellt hat, kann sein
--    Profil nie loeschen, solange `created_by` auf ihn zeigt.
-- 2. Ist er in einem Haushalt mit weiteren Mitgliedern der letzte Admin,
--    wuerde ihn niemand mehr verwalten koennen — dieselbe Situation, die
--    `guard_last_admin` schon beim manuellen Verlassen verhindert.
--
-- Statt beides in der Edge Function per einzelnen REST-Calls zu behandeln
-- (nicht atomar, RLS muesste mit Service-Role umgangen werden), laeuft es
-- hier als eine Transaktion unter der Identitaet des aufrufenden Nutzers
-- (`auth.uid()`), SECURITY DEFINER nur fuer den households-Zugriff.
--
-- Nimmt bewusst keine user_id entgegen — ausschliesslich `auth.uid()` selbst,
-- damit niemand die Loeschung fuer einen anderen Account anstossen kann.
create or replace function public.prepare_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  rec record;
  other_admins integer;
  other_members integer;
  new_owner uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Haushalte, in denen dieser Nutzer Admin ist: Bricht ab, wenn er dort der
  -- letzte Admin waere UND noch andere Mitglieder zurueckbliebe. Der Abbruch
  -- rollt die ganze Funktion zurueck — die Edge Function sieht die Exception
  -- und fragt den Nutzer nach einer Entscheidung (Admin uebertragen oder
  -- Haushalt mitloeschen), bevor sie es erneut versucht.
  for rec in
    select hm.household_id, h.name
    from public.household_members hm
    join public.households h on h.id = hm.household_id
    where hm.user_id = uid and hm.role = 'admin'
  loop
    select count(*) into other_admins
    from public.household_members
    where household_id = rec.household_id and role = 'admin' and user_id <> uid;

    select count(*) into other_members
    from public.household_members
    where household_id = rec.household_id and user_id <> uid;

    if other_admins = 0 and other_members > 0 then
      raise exception 'last_admin_with_members: % (%)', rec.name, rec.household_id;
    end if;
  end loop;

  -- Haushalte, in denen dieser Nutzer das letzte verbleibende Mitglied ist:
  -- komplett loeschen. Cascade raeumt household_members, child_profiles,
  -- fridge_items, shopping_list_items usw. mit ab (#98 AC "Haushalte mit
  -- weiteren Mitgliedern bleiben bestehen" — dieser Haushalt hat keine).
  delete from public.households h
  where exists (
    select 1 from public.household_members hm
    where hm.household_id = h.id and hm.user_id = uid
  )
  and (
    select count(*) from public.household_members hm2
    where hm2.household_id = h.id
  ) = 1;

  -- Verbleibende Haushalte, die dieser Nutzer erstellt hat: `created_by` auf
  -- ein verbleibendes Mitglied uebertragen (bevorzugt einen anderen Admin),
  -- sonst blockiert `on delete restrict` gleich die Profil-Loeschung.
  for rec in
    select id from public.households where created_by = uid
  loop
    select user_id into new_owner
    from public.household_members
    where household_id = rec.id and user_id <> uid
    order by (role = 'admin') desc, joined_at asc
    limit 1;

    if new_owner is not null then
      update public.households set created_by = new_owner where id = rec.id;
    end if;
  end loop;
end;
$$;

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

-- ------------------------------------------------- Mitgliederliste mit Namen
--
-- Mitglieder muessen sehen, wer sonst im Haushalt ist. `profiles` ist aber
-- bewusst streng privat (siehe Kopf von 02_profiles.sql): Dort liegen
-- Geburtsdatum, Geschlecht, Koerpergroesse und Aktivitaetslevel — die
-- Rechenbasis fuer das Kalorienziel. Eine SELECT-Policy koennte das nicht
-- trennen, denn RLS wirkt auf Zeilen, nicht auf Spalten: Wer die Zeile sehen
-- darf, sieht sie ganz.
--
-- Deshalb ein RPC, das genau die zwei Spalten herausgibt, die zur
-- Identifikation noetig sind — Anzeigename und Avatar. Die Gesundheitsdaten
-- bleiben unerreichbar, und was den Haushalt verlaesst, steht hier an einer
-- Stelle statt verteilt in Policies.
--
-- SECURITY DEFINER, weil die Funktion die profiles-RLS gezielt umgeht; die
-- Berechtigung prueft sie selbst ueber `is_household_member`. Ohne diese
-- Pruefung waere sie ein Leck fuer beliebige Haushalts-IDs.
--
-- Rechte fuer dieses RPC: siehe 04_privileges.sql.
create or replace function public.household_member_profiles(hid uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  role text,
  joined_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    m.user_id,
    p.display_name,
    p.avatar_url,
    m.role,
    m.joined_at
  from public.household_members as m
  -- left join: ein Mitglied ohne Profilzeile darf nicht aus der Liste fallen.
  left join public.profiles as p on p.id = m.user_id
  where m.household_id = hid
    and private.is_household_member(hid)
  order by m.joined_at;
$$;

comment on function public.household_member_profiles(uuid) is
  'Mitglieder eines Haushalts mit Anzeigename und Avatar. Gibt bewusst NUR '
  'diese beiden Profilspalten heraus — die Gesundheitsdaten in profiles '
  'bleiben privat.';
