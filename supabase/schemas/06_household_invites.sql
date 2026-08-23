-- Gewuenschter Endzustand — NICHT von Hand migrieren (#36).
-- Der Beitritt braucht ein RPC, weil Nichtmitglieder keine Mitgliedschaft einfuegen duerfen.

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,

  -- Der kryptografisch zufaellige Token ist das Einladungsgeheimnis.
  token uuid not null unique default gen_random_uuid(),

  created_by uuid not null references public.profiles (id) on delete cascade,

  -- Einladungen duerfen keinen dauerhaften Zugang offenlassen.
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_uses integer not null default 1 check (max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  revoked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint household_invites_uses_within_max check (uses <= max_uses)
);

comment on table public.household_invites is
  'Einladungstoken. Einloesung ausschliesslich ueber public.redeem_invite().';

create index if not exists household_invites_household_id_idx
  on public.household_invites (household_id);

create or replace trigger household_invites_set_updated_at
  before update on public.household_invites
  for each row
  execute function private.set_updated_at();

create or replace function public.redeem_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv record;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- Die Zeilensperre verhindert, dass parallele Einloesungen max_uses ueberschreiten.
  select * into inv
  from public.household_invites
  where token = invite_token
  for update;

  -- Fehler duerfen vor dem Beitritt keine Haushaltsdaten preisgeben.
  if not found then
    raise exception 'Einladung ungueltig';
  end if;

  if inv.revoked_at is not null then
    raise exception 'Einladung wurde zurueckgezogen';
  end if;

  if inv.expires_at <= now() then
    raise exception 'Einladung ist abgelaufen';
  end if;

  -- Wiederholte Einloesungen durch Mitglieder bleiben idempotent und kostenlos.
  if exists (
    select 1 from public.household_members
    where household_id = inv.household_id and user_id = uid
  ) then
    return inv.household_id;
  end if;

  if inv.uses >= inv.max_uses then
    raise exception 'Einladung ist aufgebraucht';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, uid, 'member');

  update public.household_invites
  set uses = uses + 1
  where id = inv.id;

  return inv.household_id;
end;
$$;

comment on function public.redeem_invite(uuid) is
  'Loest ein Einladungstoken ein und macht den Aufrufer zum Mitglied. Gibt die household_id zurueck.';

alter table public.household_invites enable row level security;

-- Nur Admins duerfen Einladungstoken sehen oder verwalten.
create policy household_invites_select_admin on public.household_invites
  for select to authenticated
  using ((select private.is_household_admin(household_id)));

create policy household_invites_insert_admin on public.household_invites
  for insert to authenticated
  with check (
    (select private.is_household_admin(household_id))
    and created_by = (select auth.uid())
  );

-- redeem_invite erhoeht uses innerhalb des SECURITY-DEFINER-RPC.
create policy household_invites_update_admin on public.household_invites
  for update to authenticated
  using ((select private.is_household_admin(household_id)))
  with check ((select private.is_household_admin(household_id)));

create policy household_invites_delete_admin on public.household_invites
  for delete to authenticated
  using ((select private.is_household_admin(household_id)));
