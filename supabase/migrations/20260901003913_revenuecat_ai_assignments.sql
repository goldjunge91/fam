-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE FUNCTION public.assign_ai_household (
  p_subscriber_user_id     uuid,
  p_target_household_id    uuid,
  p_entitlement_expires_at timestamp with time zone
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  current_household_id uuid;
  current_household_changed_at timestamptz;
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

  select household_id, household_changed_at
  into current_household_id, current_household_changed_at
  from public.revenuecat_ai_assignments
  where subscriber_user_id = p_subscriber_user_id
  for update;

  if current_household_id is null then
    insert into public.revenuecat_ai_assignments (
      subscriber_user_id,
      household_id
    )
    values (
      p_subscriber_user_id,
      p_target_household_id
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
        household_changed_at = now()
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

REVOKE ALL ON FUNCTION public.assign_ai_household(uuid, uuid, timestamp WITH time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION public.assign_ai_household(uuid, uuid, timestamp WITH time zone) TO service_role;

CREATE TABLE public.revenuecat_ai_assignments (
  subscriber_user_id   uuid                     NOT NULL,
  household_id         uuid                     NOT NULL,
  household_changed_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at           timestamp with time zone DEFAULT now() NOT NULL,
  updated_at           timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.revenuecat_ai_assignments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.revenuecat_ai_assignments
  ADD CONSTRAINT revenuecat_ai_assignments_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.revenuecat_ai_assignments
  ADD CONSTRAINT revenuecat_ai_assignments_household_id_key UNIQUE (household_id);

ALTER TABLE public.revenuecat_ai_assignments
  ADD CONSTRAINT revenuecat_ai_assignments_pkey PRIMARY KEY (subscriber_user_id);

ALTER TABLE public.revenuecat_ai_assignments
  ADD CONSTRAINT revenuecat_ai_assignments_subscriber_user_id_fkey FOREIGN KEY (subscriber_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.revenuecat_ai_assignments TO service_role;

CREATE TRIGGER revenuecat_ai_assignments_set_updated_at
  BEFORE UPDATE ON public.revenuecat_ai_assignments
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();