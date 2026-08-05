-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE FUNCTION public.redeem_invite (
  invite_token uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  inv record;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- `for update` sperrt die Zeile bis zum Commit. Ohne das koennten zwei
  -- gleichzeitige Einloesungen beide den letzten freien Platz sehen und
  -- belegen — max_uses waere dann nur eine Empfehlung.
  select * into inv
  from public.household_invites
  where token = invite_token
  for update;

  -- Alle Fehlerfaelle melden bewusst nur, was der Aufrufer ohnehin weiss oder
  -- braucht. Insbesondere wird nie der Haushaltsname genannt, bevor der
  -- Beitritt erfolgt ist.
  if not found then
    raise exception 'Einladung ungueltig';
  end if;

  if inv.revoked_at is not null then
    raise exception 'Einladung wurde zurueckgezogen';
  end if;

  if inv.expires_at <= now() then
    raise exception 'Einladung ist abgelaufen';
  end if;

  -- Bereits Mitglied: still durchwinken, ohne eine Nutzung zu verbrauchen.
  -- Ein zweiter Klick auf denselben Link darf weder fehlschlagen noch einen
  -- Platz kosten — sonst brennt ein Nutzer die Einladung fuer jemand anderen ab.
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
$function$;

COMMENT ON FUNCTION public.redeem_invite(uuid) IS 'Loest ein Einladungstoken ein und macht den Aufrufer zum Mitglied. Gibt die household_id zurueck.';

REVOKE ALL ON FUNCTION public.redeem_invite(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.redeem_invite(uuid) TO authenticated;

CREATE TABLE public.household_invites (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  household_id uuid                     NOT NULL,
  token        uuid                     DEFAULT gen_random_uuid() NOT NULL,
  created_by   uuid                     NOT NULL,
  expires_at   timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
  max_uses     integer                  DEFAULT 1 NOT NULL,
  uses         integer                  DEFAULT 0 NOT NULL,
  revoked_at   timestamp with time zone,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.household_invites IS 'Einladungstoken. Einloesung ausschliesslich ueber public.redeem_invite().';

ALTER TABLE public.household_invites
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.household_invites
  ADD CONSTRAINT household_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.household_invites
  ADD CONSTRAINT household_invites_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.household_invites
  ADD CONSTRAINT household_invites_max_uses_check CHECK (max_uses > 0);

ALTER TABLE public.household_invites
  ADD CONSTRAINT household_invites_pkey PRIMARY KEY (id);

ALTER TABLE public.household_invites
  ADD CONSTRAINT household_invites_token_key UNIQUE (token);

ALTER TABLE public.household_invites
  ADD CONSTRAINT household_invites_uses_check CHECK (uses >= 0);

ALTER TABLE public.household_invites
  ADD CONSTRAINT household_invites_uses_within_max CHECK (uses <= max_uses);

GRANT ALL ON public.household_invites TO anon;

GRANT ALL ON public.household_invites TO authenticated;

GRANT ALL ON public.household_invites TO service_role;

CREATE INDEX household_invites_household_id_idx ON public.household_invites (household_id);

CREATE TRIGGER household_invites_set_updated_at
  BEFORE UPDATE ON public.household_invites
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY household_invites_delete_admin ON public.household_invites
  FOR DELETE
  TO authenticated
  USING (( SELECT private.is_household_admin(household_invites.household_id) AS is_household_admin));

CREATE POLICY household_invites_insert_admin ON public.household_invites
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT private.is_household_admin(household_invites.household_id) AS is_household_admin) AND (created_by = ( SELECT auth.uid() AS uid))));

CREATE POLICY household_invites_select_admin ON public.household_invites
  FOR SELECT
  TO authenticated
  USING (( SELECT private.is_household_admin(household_invites.household_id) AS is_household_admin));

CREATE POLICY household_invites_update_admin ON public.household_invites
  FOR UPDATE
  TO authenticated
  USING (( SELECT private.is_household_admin(household_invites.household_id) AS is_household_admin))
  WITH CHECK (( SELECT private.is_household_admin(household_invites.household_id) AS is_household_admin));