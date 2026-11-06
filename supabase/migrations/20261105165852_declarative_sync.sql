SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.book_ai_credit (
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
  v_subscriber_user_id uuid;
  v_weight smallint;
  v_existing smallint;
  v_usage integer;
begin
  -- Lock the subscriber assignment before reading the monthly total. Every
  -- booking for one subscriber then shares this row lock through commit, so a
  -- concurrent SUM-and-INSERT cannot admit more than the remaining balance.
  select assignment.subscriber_user_id
  into v_subscriber_user_id
  from public.revenuecat_ai_assignments as assignment
  where assignment.household_id = p_household_id
    and assignment.active
  for update of assignment;

  if v_subscriber_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'ai_household_not_assigned';
  end if;

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
  where b.subscriber_user_id = v_subscriber_user_id and b.request_id = p_request_id;

  if v_existing is null then
    v_usage := private.ai_credit_month_usage(v_subscriber_user_id);
    if v_usage + v_weight > p_monthly_limit then
      raise exception using errcode = 'P0001', message = 'ai_credit_limit_exceeded';
    end if;

    insert into public.ai_credit_bookings (subscriber_user_id, request_id, action, credits)
    values (v_subscriber_user_id, p_request_id, p_action, v_weight);

    v_usage := v_usage + v_weight;
  else
    v_usage := private.ai_credit_month_usage(v_subscriber_user_id);
  end if;

  return query select
    v_usage,
    greatest(p_monthly_limit - v_usage, 0),
    p_monthly_limit,
    v_usage >= ceil(p_monthly_limit * 0.8),
    v_usage >= p_monthly_limit;
end;
$function$;
