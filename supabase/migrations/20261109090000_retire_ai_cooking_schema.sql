-- Remove only schema introduced by the superseded AI cooking implementation.
-- AI credit bookings and their existing metadata remain; the current branch
-- uses this table, and the migration restores its current RPC contract.
SET LOCAL check_function_bodies = off;

DROP FUNCTION IF EXISTS public.get_chef_conversation_context(uuid, uuid, uuid, integer, integer);
DROP FUNCTION IF EXISTS public.lookup_chef_exchange(uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.persist_chef_exchange(uuid, uuid, uuid, uuid, uuid, text, jsonb, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.preflight_chef_exchange(uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS private.chef_recipe_response_is_valid(jsonb);

DROP TABLE IF EXISTS public.chef_recipe_history;
DROP TABLE IF EXISTS public.chef_conversation_turns;
DROP TABLE IF EXISTS public.chef_conversations;
DROP TABLE IF EXISTS public.catalog_recipe_item_ingredient_links;
DROP TABLE IF EXISTS public.ingredient_allergen_mappings;
DROP TABLE IF EXISTS public.product_ingredient_links;

ALTER TABLE IF EXISTS public.food_ingredients
  DROP COLUMN IF EXISTS allergen_reviewed_at;

DROP FUNCTION public.book_ai_credit(uuid, text, uuid, integer, uuid);

CREATE FUNCTION public.book_ai_credit (
  p_household_id                uuid,
  p_action                      text,
  p_request_id                  uuid,
  p_monthly_limit               integer DEFAULT 100,
  p_expected_subscriber_user_id uuid DEFAULT NULL::uuid
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
  v_refunded boolean;
  v_usage integer;
begin
  select assignment.subscriber_user_id
  into v_subscriber_user_id
  from public.revenuecat_ai_assignments as assignment
  where assignment.household_id = p_household_id
    and assignment.active
  for update of assignment;

  if v_subscriber_user_id is null then
    raise exception using errcode = '42501', message = 'ai_household_not_assigned';
  end if;

  if p_expected_subscriber_user_id is not null
    and v_subscriber_user_id <> p_expected_subscriber_user_id
  then
    raise exception using errcode = '40001', message = 'ai_subscriber_changed';
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

  select booking.credits,
    exists (
      select 1
      from public.ai_credit_refunds as refund
      where refund.subscriber_user_id = booking.subscriber_user_id
        and refund.request_id = booking.request_id
    )
  into v_existing, v_refunded
  from public.ai_credit_bookings as booking
  where booking.subscriber_user_id = v_subscriber_user_id
    and booking.request_id = p_request_id;

  if v_existing is null then
    v_usage := private.ai_credit_month_usage(v_subscriber_user_id);
    if v_usage + v_weight > p_monthly_limit then
      raise exception using errcode = 'P0001', message = 'ai_credit_limit_exceeded';
    end if;

    insert into public.ai_credit_bookings (
      subscriber_user_id, request_id, action, credits
    ) values (
      v_subscriber_user_id, p_request_id, p_action, v_weight
    );

    v_usage := v_usage + v_weight;
  else
    if v_refunded then
      raise exception using errcode = '22023', message = 'ai_credit_request_refunded';
    end if;
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

REVOKE ALL ON FUNCTION public.book_ai_credit(uuid, text, uuid, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_ai_credit(uuid, text, uuid, integer, uuid)
  TO service_role;
