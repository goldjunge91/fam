-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE FUNCTION private.ai_credit_month_usage (
  p_household_id uuid
)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select coalesce(sum(credits), 0)::integer
  from public.ai_credit_bookings
  where household_id = p_household_id
    and created_at >= (date_trunc('month', (now() at time zone 'UTC')) at time zone 'UTC');
$function$;

REVOKE ALL ON FUNCTION private.ai_credit_month_usage(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION private.ai_credit_month_usage(uuid) TO service_role;

CREATE FUNCTION public.book_ai_credit (
  p_household_id  uuid,
  p_action        text,
  p_request_id    uuid,
  p_monthly_limit integer DEFAULT 100
)
  RETURNS TABLE (
    credits_used      integer,
    credits_remaining integer,
    credit_limit      integer,
    warning_reached   boolean,
    blocked           boolean
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_weight smallint;
  v_existing smallint;
  v_usage integer;
begin
  v_weight := case p_action
    when 'suggestion' then 1
    when 'recipe' then 3
    when 'voice' then 2
    else null
  end;
  if v_weight is null then
    raise exception using errcode = '22023', message = 'ai_credit_invalid_action';
  end if;

  select b.credits into v_existing
  from public.ai_credit_bookings as b
  where b.household_id = p_household_id and b.request_id = p_request_id;

  if v_existing is null then
    v_usage := private.ai_credit_month_usage(p_household_id);
    if v_usage + v_weight > p_monthly_limit then
      raise exception using errcode = 'P0001', message = 'ai_credit_limit_exceeded';
    end if;

    insert into public.ai_credit_bookings (household_id, request_id, action, credits)
    values (p_household_id, p_request_id, p_action, v_weight);

    v_usage := v_usage + v_weight;
  else
    v_usage := private.ai_credit_month_usage(p_household_id);
  end if;

  return query select
    v_usage,
    greatest(p_monthly_limit - v_usage, 0),
    p_monthly_limit,
    v_usage >= ceil(p_monthly_limit * 0.8),
    v_usage >= p_monthly_limit;
end;
$function$;

REVOKE ALL ON FUNCTION public.book_ai_credit(uuid, text, uuid, integer) FROM PUBLIC;

GRANT ALL ON FUNCTION public.book_ai_credit(uuid, text, uuid, integer) TO service_role;

CREATE FUNCTION public.get_ai_credit_status (
  p_household_id  uuid,
  p_monthly_limit integer DEFAULT 100
)
  RETURNS TABLE (
    credits_used      integer,
    credits_remaining integer,
    credit_limit      integer,
    warning_reached   boolean,
    blocked           boolean
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select
    usage.credits_used,
    greatest(p_monthly_limit - usage.credits_used, 0),
    p_monthly_limit,
    usage.credits_used >= ceil(p_monthly_limit * 0.8),
    usage.credits_used >= p_monthly_limit
  from (select private.ai_credit_month_usage(p_household_id) as credits_used) as usage;
$function$;

REVOKE ALL ON FUNCTION public.get_ai_credit_status(uuid, integer) FROM PUBLIC;

GRANT ALL ON FUNCTION public.get_ai_credit_status(uuid, integer) TO service_role;

CREATE TABLE public.ai_credit_bookings (
  household_id uuid                     NOT NULL,
  request_id   uuid                     NOT NULL,
  action       text                     NOT NULL,
  credits      smallint                 NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.ai_credit_bookings
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_credit_bookings
  ADD CONSTRAINT ai_credit_bookings_action_check CHECK (action = ANY (ARRAY['suggestion'::text, 'recipe'::text, 'voice'::text]));

ALTER TABLE public.ai_credit_bookings
  ADD CONSTRAINT ai_credit_bookings_credits_check CHECK (credits > 0);

ALTER TABLE public.ai_credit_bookings
  ADD CONSTRAINT ai_credit_bookings_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.ai_credit_bookings
  ADD CONSTRAINT ai_credit_bookings_pkey PRIMARY KEY (household_id, request_id);

GRANT INSERT, SELECT ON public.ai_credit_bookings TO service_role;

CREATE INDEX ai_credit_bookings_household_created_idx ON public.ai_credit_bookings (household_id, created_at);