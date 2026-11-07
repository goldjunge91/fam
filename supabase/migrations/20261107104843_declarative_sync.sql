SET local check_function_bodies = off;

ALTER TABLE "public"."ai_credit_bookings"
  ADD COLUMN "household_id" uuid;

CREATE OR REPLACE FUNCTION public.book_ai_credit (
  p_household_id                uuid,
  p_action                      text,
  p_request_id                  uuid,
  p_monthly_limit               integer DEFAULT 100,
  p_expected_subscriber_user_id uuid    DEFAULT NULL::uuid
)
  RETURNS TABLE (
    credits_used      integer,
    credits_remaining integer,
    credit_limit      integer,
    warning_reached   boolean,
    blocked           boolean,
    booking_created   boolean
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_subscriber_user_id uuid;
  v_weight smallint;
  v_existing_subscriber_user_id uuid;
  v_existing_household_id uuid;
  v_existing_action text;
  v_existing smallint;
  v_refunded boolean;
  v_usage integer;
  v_booking_created boolean := false;
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

  if p_expected_subscriber_user_id is not null
    and v_subscriber_user_id <> p_expected_subscriber_user_id
  then
    raise exception using
      errcode = '40001',
      message = 'ai_subscriber_changed';
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

  select b.subscriber_user_id,
    b.household_id,
    b.action,
    b.credits,
    exists (
      select 1
      from public.ai_credit_refunds as refund
      where refund.subscriber_user_id = b.subscriber_user_id
        and refund.request_id = b.request_id
    )
  into v_existing_subscriber_user_id,
    v_existing_household_id,
    v_existing_action,
    v_existing,
    v_refunded
  from public.ai_credit_bookings as b
  where b.request_id = p_request_id;

  if v_existing is not null and (
    v_existing_subscriber_user_id <> v_subscriber_user_id
    or v_existing_household_id is distinct from p_household_id
    or v_existing_action <> p_action
    or v_existing <> v_weight
  ) then
    raise exception using
      errcode = '22023',
      message = 'ai_credit_request_mismatch';
  end if;

  if v_existing is null then
    v_usage := private.ai_credit_month_usage(v_subscriber_user_id);
    if v_usage + v_weight > p_monthly_limit then
      raise exception using errcode = 'P0001', message = 'ai_credit_limit_exceeded';
    end if;

    insert into public.ai_credit_bookings (
      subscriber_user_id,
      household_id,
      request_id,
      action,
      credits
    )
    values (v_subscriber_user_id, p_household_id, p_request_id, p_action, v_weight);

    v_booking_created := true;
    v_usage := v_usage + v_weight;
  else
    if v_refunded then
      raise exception using
        errcode = '22023',
        message = 'ai_credit_request_refunded';
    end if;
    v_usage := private.ai_credit_month_usage(v_subscriber_user_id);
  end if;

  return query select
    v_usage,
    greatest(p_monthly_limit - v_usage, 0),
    p_monthly_limit,
    v_usage >= ceil(p_monthly_limit * 0.8),
    v_usage >= p_monthly_limit,
    v_booking_created;
end;
$function$;

CREATE OR REPLACE FUNCTION public.lookup_chef_exchange (
  p_household_id        uuid,
  p_actor_user_id       uuid,
  p_client_request_id   uuid,
  p_request_fingerprint text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_turn public.chef_conversation_turns%rowtype;
  v_hydration jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_client_request_id::text, 0));

  if not exists (
    select 1
    from public.household_members as member
    where member.household_id = p_household_id
      and member.user_id = p_actor_user_id
  ) then
    return jsonb_build_object('schema_version', 1, 'status', 'conflict');
  end if;

  select turn.*
  into v_turn
  from public.chef_conversation_turns as turn
  where turn.client_request_id = p_client_request_id;

  if not found then
    if exists (
      select 1
      from public.ai_credit_bookings as booking
      where booking.request_id = p_client_request_id
        and booking.household_id = p_household_id
    ) then
      if exists (
        select 1
        from public.ai_credit_refunds as refund
        join public.ai_credit_bookings as booking
          on booking.subscriber_user_id = refund.subscriber_user_id
          and booking.request_id = refund.request_id
        where refund.request_id = p_client_request_id
          and booking.household_id = p_household_id
      ) then
        return jsonb_build_object('schema_version', 1, 'status', 'refunded');
      end if;
      return jsonb_build_object('schema_version', 1, 'status', 'incomplete');
    end if;
    if exists (
      select 1
      from public.ai_credit_bookings as booking
      where booking.request_id = p_client_request_id
    ) then
      return jsonb_build_object('schema_version', 1, 'status', 'conflict');
    end if;
    return jsonb_build_object('schema_version', 1, 'status', 'missing');
  end if;

  if v_turn.household_id <> p_household_id
    or v_turn.request_fingerprint <> p_request_fingerprint
  then
    return jsonb_build_object('schema_version', 1, 'status', 'conflict');
  end if;

  select jsonb_build_object(
    'schema_version', 1,
    'replayed', true,
    'conversation', jsonb_build_object(
      'id', conversation.id,
      'household_id', conversation.household_id,
      'created_by', conversation.created_by,
      'created_at', conversation.created_at,
      'last_activity_at', conversation.last_activity_at,
      'continued_from_id', conversation.continued_from_id,
      'updated_at', conversation.updated_at
    ),
    'turn', jsonb_build_object(
      'id', turn.id,
      'conversation_id', turn.conversation_id,
      'household_id', turn.household_id,
      'created_by', turn.created_by,
      'client_request_id', turn.client_request_id,
      'request_fingerprint', turn.request_fingerprint,
      'user_text', turn.user_text,
      'request_payload', turn.request_payload,
      'response_payload', turn.response_payload,
      'created_at', turn.created_at
    ),
    'recipe_history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', recipe.id,
        'conversation_id', recipe.conversation_id,
        'turn_id', recipe.turn_id,
        'household_id', recipe.household_id,
        'title', recipe.title,
        'recipe_payload', recipe.recipe_payload,
        'created_at', recipe.created_at
      ) order by recipe.created_at, recipe.id)
      from public.chef_recipe_history as recipe
      where recipe.turn_id = turn.id
    ), '[]'::jsonb)
  )
  into v_hydration
  from public.chef_conversations as conversation
  join public.chef_conversation_turns as turn
    on turn.conversation_id = conversation.id
    and turn.household_id = conversation.household_id
  where turn.id = v_turn.id;

  return jsonb_build_object(
    'schema_version', 1,
    'status', 'match',
    'hydration', v_hydration
  );
end;
$function$;

ALTER TABLE "public"."ai_credit_bookings"
  ADD CONSTRAINT "ai_credit_bookings_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE SET NULL;
