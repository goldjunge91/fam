-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP FUNCTION public.assign_ai_household(p_subscriber_user_id uuid, p_target_household_id uuid, p_entitlement_expires_at timestamp WITH time zone);

CREATE FUNCTION public.assign_ai_household (
  p_subscriber_user_id     uuid,
  p_target_household_id    uuid,
  p_entitlement_expires_at timestamp with time zone,
  p_event_timestamp_ms     bigint                   DEFAULT NULL::bigint
)
  RETURNS void
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
    return;
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
end;
$function$;

REVOKE ALL ON FUNCTION public.assign_ai_household(uuid, uuid, timestamp WITH time zone, bigint) FROM PUBLIC;

GRANT ALL ON FUNCTION public.assign_ai_household(uuid, uuid, timestamp WITH time zone, bigint) TO service_role;

CREATE FUNCTION public.deactivate_ai_household (
  p_subscriber_user_id uuid,
  p_event_timestamp_ms bigint DEFAULT NULL::bigint
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  current_household_id uuid;
  current_event_timestamp_ms bigint;
begin
  select household_id, last_event_timestamp_ms
  into current_household_id, current_event_timestamp_ms
  from public.revenuecat_ai_assignments
  where subscriber_user_id = p_subscriber_user_id
  for update;

  if current_household_id is null then
    return;
  end if;

  if p_event_timestamp_ms is not null
    and current_event_timestamp_ms is not null
    and p_event_timestamp_ms < current_event_timestamp_ms
  then
    return;
  end if;

  update public.households
  set ai_active = false,
      ai_expires_at = null,
      ai_updated_at = now(),
      ai_subscriber_id = null
  where id = current_household_id
    and ai_subscriber_id = p_subscriber_user_id;

  update public.revenuecat_ai_assignments
  set last_event_timestamp_ms = p_event_timestamp_ms
  where subscriber_user_id = p_subscriber_user_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.deactivate_ai_household(uuid, bigint) FROM PUBLIC;

GRANT ALL ON FUNCTION public.deactivate_ai_household(uuid, bigint) TO service_role;

ALTER TABLE public.households
  ADD COLUMN plus_last_event_timestamp_ms bigint;

ALTER TABLE public.revenuecat_ai_assignments
  ADD COLUMN last_event_timestamp_ms bigint;

CREATE TABLE public.revenuecat_processed_events (
  event_id       text                     NOT NULL,
  entitlement_id text                     NOT NULL,
  processed_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.revenuecat_processed_events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.revenuecat_processed_events
  ADD CONSTRAINT revenuecat_processed_events_entitlement_id_check CHECK (entitlement_id = ANY (ARRAY['Plus'::text, 'AI'::text]));

ALTER TABLE public.revenuecat_processed_events
  ADD CONSTRAINT revenuecat_processed_events_pkey PRIMARY KEY (event_id, entitlement_id);

GRANT INSERT, SELECT ON public.revenuecat_processed_events TO service_role;