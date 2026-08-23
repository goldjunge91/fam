-- Gewuenschter Endzustand — NICHT von Hand migrieren.
-- Haushalte begrenzen geteilte Daten; Tracking-Daten bleiben privat.

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Premium gilt haushaltsweit und wird ausschliesslich vom RevenueCat-Webhook
  -- gepflegt, damit Mitglieder sich nicht selbst freischalten koennen.
  premium_active boolean not null default false,
  premium_expires_at timestamptz,
  premium_updated_at timestamptz
);

-- UUIDs erlauben Offline-Erstellung; updated_at macht Rollenwechsel und
-- Entfernungen fuer den inkrementellen Pull sichtbar.
create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Der separate Index beschleunigt die Gegenrichtung des zusammengesetzten PKs.
create index if not exists household_members_user_id_idx
  on public.household_members (user_id);
create index if not exists households_created_by_idx
  on public.households (created_by);

create or replace trigger households_set_updated_at
  before update on public.households
  for each row
  execute function private.set_updated_at();

-- SECURITY DEFINER verhindert rekursive RLS-Abfragen auf household_members.

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

-- create_household steht nach den Lagerort-Tabellen, damit Haushalt, Admin und
-- Standardorte atomar entstehen.

-- Verhindert einen Haushalt mit Mitgliedern, aber ohne Administrator.
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

  -- Bei einer Haushalts-Kaskade ist die Elternzeile bereits weg; die Sperre
  -- darf diesen Fall nicht blockieren.
  if not exists (select 1 from public.households where id = old.household_id) then
    return coalesce(new, old);
  end if;

  -- Ein leer werdender Haushalt darf seinen letzten Admin verlieren.
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

-- Triggernamen sichern die Reihenfolge: Guard vor updated_at.
create or replace trigger household_members_set_updated_at
  before update on public.household_members
  for each row
  execute function private.set_updated_at();

-- Entfernt leere Haushalte samt Kaskade. SECURITY DEFINER ist noetig, weil das
-- letzte Mitglied beim Loeschen seine Haushaltsberechtigung bereits verliert.
create or replace function private.delete_orphaned_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.household_members
    where household_id = old.household_id
  ) then
    delete from public.households where id = old.household_id;
  end if;

  return old;
end;
$$;

create or replace trigger household_members_delete_orphaned_household
  after delete on public.household_members
  for each row
  execute function private.delete_orphaned_household();

-- Bereinigt Haushaltsbezuege atomar vor dem Loeschen aus auth.users.
-- Die Funktion akzeptiert keine user_id und arbeitet nur fuer auth.uid().
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

  -- Mit verbleibenden Mitgliedern darf kein Haushalt ohne Admin entstehen.
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

  -- Allein bewohnte Haushalte werden mitsamt ihrer Kaskade geloescht.
  delete from public.households h
  where exists (
    select 1 from public.household_members hm
    where hm.household_id = h.id and hm.user_id = uid
  )
  and (
    select count(*) from public.household_members hm2
    where hm2.household_id = h.id
  ) = 1;

  -- created_by muss vor der Profil-Loeschung auf ein verbleibendes Mitglied wechseln.
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

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- Haushalte sind fuer Mitglieder sichtbar und nur fuer Admins aenderbar.
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

-- Die SECURITY-DEFINER-Pruefung vermeidet rekursive RLS auf household_members.
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

create policy household_members_delete on public.household_members
  for delete to authenticated
  using (
    (select private.is_household_admin(household_id))
    or user_id = (select auth.uid())
  );

-- Gibt nur Anzeigename und Avatar frei, weil RLS keine Profilspalten verbergen kann.
-- SECURITY DEFINER umgeht die Profil-RLS erst nach eigener Mitgliedschaftspruefung.
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
  left join public.profiles as p on p.id = m.user_id
  where m.household_id = hid
    and private.is_household_member(hid)
  order by m.joined_at;
$$;

comment on function public.household_member_profiles(uuid) is
  'Mitglieder eines Haushalts mit Anzeigename und Avatar. Gibt bewusst NUR '
  'diese beiden Profilspalten heraus — die Gesundheitsdaten in profiles '
  'bleiben privat.';
