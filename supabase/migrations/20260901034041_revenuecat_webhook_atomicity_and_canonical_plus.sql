-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP FUNCTION public.assign_ai_household(p_subscriber_user_id uuid, p_target_household_id uuid, p_entitlement_expires_at timestamp WITH time zone, p_event_timestamp_ms bigint);

DROP FUNCTION public.deactivate_ai_household(p_subscriber_user_id uuid, p_event_timestamp_ms bigint);

CREATE FUNCTION private.mark_webhook_event_processed (
  p_event_id       text,
  p_entitlement_id text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if p_event_id is null then
    return true;
  end if;

  insert into public.revenuecat_processed_events (event_id, entitlement_id)
  values (p_event_id, p_entitlement_id)
  on conflict (event_id, entitlement_id) do nothing;

  return found;
end;
$function$;

REVOKE ALL ON FUNCTION private.mark_webhook_event_processed(text, text) FROM PUBLIC;

GRANT ALL ON FUNCTION private.mark_webhook_event_processed(text, text) TO service_role;

CREATE FUNCTION private.recompute_household_plus (
  p_household_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_active boolean;
  v_expires_at timestamptz;
begin
  select bool_or(active), max(expires_at) filter (where active)
  into v_active, v_expires_at
  from public.revenuecat_plus_assignments
  where household_id = p_household_id;

  update public.households
  set plus_active = coalesce(v_active, false),
      plus_expires_at = case when coalesce(v_active, false) then v_expires_at else null end,
      plus_updated_at = now()
  where id = p_household_id;
end;
$function$;

REVOKE ALL ON FUNCTION private.recompute_household_plus(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION private.recompute_household_plus(uuid) TO service_role;

CREATE FUNCTION public.apply_plus_household_event (
  p_subscriber_user_id uuid,
  p_household_id       uuid,
  p_active             boolean,
  p_expires_at         timestamp with time zone,
  p_event_timestamp_ms bigint                   DEFAULT NULL::bigint,
  p_event_id           text                     DEFAULT NULL::text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_household_id uuid;
  v_event_timestamp_ms bigint;
begin
  if not private.mark_webhook_event_processed(p_event_id, 'Plus') then
    return false;
  end if;

  select household_id, last_event_timestamp_ms
  into v_household_id, v_event_timestamp_ms
  from public.revenuecat_plus_assignments
  where subscriber_user_id = p_subscriber_user_id
  for update;

  if v_household_id is not null
    and p_event_timestamp_ms is not null
    and v_event_timestamp_ms is not null
    and p_event_timestamp_ms < v_event_timestamp_ms
  then
    return false;
  end if;

  if v_household_id is null then
    if not exists (
      select 1 from public.household_members
      where household_id = p_household_id and user_id = p_subscriber_user_id
    ) then
      raise exception using
        errcode = '42501',
        message = 'plus_target_household_forbidden';
    end if;

    v_household_id := p_household_id;
    insert into public.revenuecat_plus_assignments (
      subscriber_user_id, household_id, active, expires_at, last_event_timestamp_ms
    )
    values (
      p_subscriber_user_id, v_household_id, p_active, p_expires_at, p_event_timestamp_ms
    );
  else
    update public.revenuecat_plus_assignments
    set active = p_active,
        expires_at = p_expires_at,
        last_event_timestamp_ms = p_event_timestamp_ms
    where subscriber_user_id = p_subscriber_user_id;
  end if;

  perform private.recompute_household_plus(v_household_id);
  return true;
end;
$function$;

REVOKE ALL ON FUNCTION public.apply_plus_household_event(uuid, uuid, boolean, timestamp WITH time zone, bigint, text) FROM PUBLIC;

GRANT ALL ON FUNCTION public.apply_plus_household_event(uuid, uuid, boolean, timestamp WITH time zone, bigint, text) TO service_role;

CREATE FUNCTION public.assign_ai_household (
  p_subscriber_user_id     uuid,
  p_target_household_id    uuid,
  p_entitlement_expires_at timestamp with time zone,
  p_event_timestamp_ms     bigint                   DEFAULT NULL::bigint,
  p_event_id               text                     DEFAULT NULL::text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  current_household_id uuid;
  current_household_changed_at timestamptz;
  current_event_timestamp_ms bigint;
begin
  if not exists (
    select 1
    from public.household_members
    where household_id = p_target_household_id
      and user_id = p_subscriber_user_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'ai_target_household_forbidden';
  end if;

  if not private.mark_webhook_event_processed(p_event_id, 'AI') then
    return false;
  end if;

  select household_id, household_changed_at, last_event_timestamp_ms
  into current_household_id, current_household_changed_at, current_event_timestamp_ms
  from public.revenuecat_ai_assignments
  where subscriber_user_id = p_subscriber_user_id
  for update;

  if current_household_id is not null
    and p_event_timestamp_ms is not null
    and current_event_timestamp_ms is not null
    and p_event_timestamp_ms < current_event_timestamp_ms
  then
    return false;
  end if;

  if current_household_id is null then
    insert into public.revenuecat_ai_assignments (
      subscriber_user_id,
      household_id,
      last_event_timestamp_ms
    )
    values (
      p_subscriber_user_id,
      p_target_household_id,
      p_event_timestamp_ms
    );
  elsif current_household_id <> p_target_household_id then
    if date_trunc('month', current_household_changed_at at time zone 'UTC')
      >= date_trunc('month', now() at time zone 'UTC') then
      raise exception 'ai_household_change_cooldown';
    end if;

    update public.households
    set ai_active = false,
        ai_expires_at = null,
        ai_updated_at = now(),
        ai_subscriber_id = null
    where id = current_household_id
      and ai_subscriber_id = p_subscriber_user_id;

    update public.revenuecat_ai_assignments
    set household_id = p_target_household_id,
        household_changed_at = now(),
        last_event_timestamp_ms = p_event_timestamp_ms
    where subscriber_user_id = p_subscriber_user_id;
  else
    update public.revenuecat_ai_assignments
    set last_event_timestamp_ms = p_event_timestamp_ms
    where subscriber_user_id = p_subscriber_user_id;
  end if;

  update public.households
  set ai_active = true,
      ai_expires_at = p_entitlement_expires_at,
      ai_updated_at = now(),
      ai_subscriber_id = p_subscriber_user_id
  where id = p_target_household_id;

  return true;
end;
$function$;

REVOKE ALL ON FUNCTION public.assign_ai_household(uuid, uuid, timestamp WITH time zone, bigint, text) FROM PUBLIC;

GRANT ALL ON FUNCTION public.assign_ai_household(uuid, uuid, timestamp WITH time zone, bigint, text) TO service_role;

CREATE FUNCTION public.deactivate_ai_household (
  p_subscriber_user_id uuid,
  p_event_timestamp_ms bigint DEFAULT NULL::bigint,
  p_event_id           text   DEFAULT NULL::text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  current_household_id uuid;
  current_event_timestamp_ms bigint;
begin
  if not private.mark_webhook_event_processed(p_event_id, 'AI') then
    return false;
  end if;

  select household_id, last_event_timestamp_ms
  into current_household_id, current_event_timestamp_ms
  from public.revenuecat_ai_assignments
  where subscriber_user_id = p_subscriber_user_id
  for update;

  if current_household_id is null then
    return false;
  end if;

  if p_event_timestamp_ms is not null
    and current_event_timestamp_ms is not null
    and p_event_timestamp_ms < current_event_timestamp_ms
  then
    return false;
  end if;

  update public.households
  set ai_active = false,
      ai_expires_at = null,
      ai_updated_at = now(),
      ai_subscriber_id = null
  where id = current_household_id
    and ai_subscriber_id = p_subscriber_user_id;

  delete from public.revenuecat_ai_assignments
  where subscriber_user_id = p_subscriber_user_id;

  return true;
end;
$function$;

REVOKE ALL ON FUNCTION public.deactivate_ai_household(uuid, bigint, text) FROM PUBLIC;

GRANT ALL ON FUNCTION public.deactivate_ai_household(uuid, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_account_deletion()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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

  -- AI/Plus vorher deaktivieren: sonst verletzt die FK-Aktion auf
  -- ai_subscriber_id gleich den Active-Subscriber-Constraint.
  update public.households
  set ai_active = false, ai_expires_at = null, ai_updated_at = now(), ai_subscriber_id = null
  where ai_subscriber_id = uid;

  delete from public.revenuecat_ai_assignments where subscriber_user_id = uid;

  for rec in
    select household_id from public.revenuecat_plus_assignments where subscriber_user_id = uid
  loop
    delete from public.revenuecat_plus_assignments
    where subscriber_user_id = uid and household_id = rec.household_id;
    perform private.recompute_household_plus(rec.household_id);
  end loop;

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
$function$;

CREATE TABLE public.revenuecat_plus_assignments (
  subscriber_user_id      uuid                     NOT NULL,
  household_id            uuid                     NOT NULL,
  active                  boolean                  DEFAULT true NOT NULL,
  expires_at              timestamp with time zone,
  last_event_timestamp_ms bigint,
  created_at              timestamp with time zone DEFAULT now() NOT NULL,
  updated_at              timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.revenuecat_plus_assignments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.revenuecat_plus_assignments
  ADD CONSTRAINT revenuecat_plus_assignments_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.revenuecat_plus_assignments
  ADD CONSTRAINT revenuecat_plus_assignments_pkey PRIMARY KEY (subscriber_user_id);

ALTER TABLE public.revenuecat_plus_assignments
  ADD CONSTRAINT revenuecat_plus_assignments_subscriber_user_id_fkey FOREIGN KEY (subscriber_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.revenuecat_plus_assignments TO service_role;

CREATE INDEX revenuecat_plus_assignments_household_active_idx ON public.revenuecat_plus_assignments (household_id)
  WHERE active;

CREATE TRIGGER revenuecat_plus_assignments_set_updated_at
  BEFORE UPDATE ON public.revenuecat_plus_assignments
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();