-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

ALTER TABLE public.revenuecat_ai_assignments
  DROP CONSTRAINT revenuecat_ai_assignments_household_id_key;

CREATE OR REPLACE FUNCTION private.ai_credit_subscriber_for_household (
  p_household_id uuid
)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select subscriber_user_id
  from public.revenuecat_ai_assignments
  where household_id = p_household_id
    and active;
$function$;

CREATE OR REPLACE FUNCTION private.recompute_household_plus (
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
  -- Alle Quellen desselben Haushalts teilen sich diese Sperre. Dadurch kann
  -- keine parallel laufende Neuberechnung einen neueren Aggregatzustand mit
  -- einem Snapshot ueberschreiben, in dem eine andere Quelle noch fehlt.
  perform 1
  from public.households
  where id = p_household_id
  for update;

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

CREATE OR REPLACE FUNCTION public.assign_ai_household (
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

  if p_event_timestamp_ms is not null
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
        active = true,
        last_event_timestamp_ms = p_event_timestamp_ms
    where subscriber_user_id = p_subscriber_user_id;
  else
    update public.revenuecat_ai_assignments
    set active = true,
        last_event_timestamp_ms = p_event_timestamp_ms
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

CREATE OR REPLACE FUNCTION public.deactivate_ai_household (
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

  update public.revenuecat_ai_assignments
  set active = false,
      last_event_timestamp_ms = p_event_timestamp_ms
  where subscriber_user_id = p_subscriber_user_id;

  return true;
end;
$function$;

ALTER TABLE public.revenuecat_ai_assignments
  ADD COLUMN active boolean DEFAULT true NOT NULL;

CREATE UNIQUE INDEX revenuecat_ai_assignments_active_household_idx ON public.revenuecat_ai_assignments (household_id)
  WHERE active;