SET local check_function_bodies = off;

DROP FUNCTION "public"."book_ai_credit"(uuid, text, uuid, integer, uuid);

CREATE TABLE "public"."chef_conversation_turns" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id"     uuid                     NOT NULL,
  "household_id"        uuid                     NOT NULL,
  "created_by"          uuid,
  "client_request_id"   uuid                     NOT NULL,
  "request_fingerprint" text                     NOT NULL,
  "user_text"           text                     NOT NULL,
  "request_payload"     jsonb                    NOT NULL,
  "response_payload"    jsonb                    NOT NULL,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chef_conversation_turns_client_request_id_key" UNIQUE (client_request_id),
  CONSTRAINT "chef_conversation_turns_id_conversation_id_household_id_key" UNIQUE (id, conversation_id, household_id),
  CONSTRAINT "chef_conversation_turns_pkey" PRIMARY KEY (id),
  CONSTRAINT "chef_turns_fingerprint_check" CHECK ((request_fingerprint ~ '^[0-9a-f]{64}$'::text)),
  CONSTRAINT "chef_turns_request_payload_check"
    CHECK (((jsonb_typeof(request_payload) = 'object'::text) AND ((request_payload ->> 'schema_version'::text) = '1'::text) AND (octet_length((request_payload)::text) <= 65536))),
  CONSTRAINT "chef_turns_response_payload_check"
    CHECK
    (((jsonb_typeof(response_payload) = 'object'::text) AND ((response_payload ->> 'schema_version'::text) = '1'::text) AND (octet_length((response_payload)::text) <= 262144))),
  CONSTRAINT "chef_turns_user_text_check" CHECK (((length(TRIM(BOTH FROM user_text)) >= 1) AND (length(TRIM(BOTH FROM user_text)) <= 8000)))
);

ALTER TABLE "public"."chef_conversation_turns"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."chef_conversation_turns" FROM "anon", "service_role";

CREATE TABLE "public"."chef_conversations" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "household_id"      uuid                     NOT NULL,
  "created_by"        uuid,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "last_activity_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "continued_from_id" uuid,
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chef_conversations_id_household_id_key" UNIQUE (id, household_id),
  CONSTRAINT "chef_conversations_parent_not_self" CHECK (((continued_from_id IS NULL) OR (continued_from_id <> id))),
  CONSTRAINT "chef_conversations_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."chef_conversations"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."chef_conversations" FROM "anon", "service_role";

CREATE TABLE "public"."chef_recipe_history" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" uuid                     NOT NULL,
  "turn_id"         uuid                     NOT NULL,
  "household_id"    uuid                     NOT NULL,
  "title"           text                     NOT NULL,
  "recipe_payload"  jsonb                    NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chef_recipe_history_id_household_id_key" UNIQUE (id, household_id),
  CONSTRAINT "chef_recipe_history_payload_check"
    CHECK (((jsonb_typeof(recipe_payload) = 'object'::text) AND ((recipe_payload ->> 'schema_version'::text) = '1'::text) AND (octet_length((recipe_payload)::text) <= 262144))),
  CONSTRAINT "chef_recipe_history_pkey" PRIMARY KEY (id),
  CONSTRAINT "chef_recipe_history_title_check" CHECK (((length(TRIM(BOTH FROM title)) >= 1) AND (length(TRIM(BOTH FROM title)) <= 8000))),
  CONSTRAINT "chef_recipe_history_turn_id_key" UNIQUE (turn_id)
);

ALTER TABLE "public"."chef_recipe_history"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."chef_recipe_history" FROM "anon", "service_role";

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
    b.action,
    b.credits,
    exists (
      select 1
      from public.ai_credit_refunds as refund
      where refund.subscriber_user_id = b.subscriber_user_id
        and refund.request_id = b.request_id
    )
  into v_existing_subscriber_user_id, v_existing_action, v_existing, v_refunded
  from public.ai_credit_bookings as b
  where b.request_id = p_request_id;

  if v_existing is not null and (
    v_existing_subscriber_user_id <> v_subscriber_user_id
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

    insert into public.ai_credit_bookings (subscriber_user_id, request_id, action, credits)
    values (v_subscriber_user_id, p_request_id, p_action, v_weight);

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

REVOKE ALL ON FUNCTION "public"."book_ai_credit"(uuid, text, uuid, integer, uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.get_chef_conversation_context (
  p_household_id    uuid,
  p_actor_user_id   uuid,
  p_conversation_id uuid,
  p_max_depth       integer DEFAULT 20,
  p_max_chars       integer DEFAULT 32000
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_turns jsonb := '[]'::jsonb;
  v_item jsonb;
  v_chars integer := 0;
  v_truncated boolean := false;
  v_row record;
begin
  if p_max_depth < 1 or p_max_depth > 20 or p_max_chars < 1 or p_max_chars > 32000 then
    raise exception using errcode = '22023', message = 'chef_history_context_limits_invalid';
  end if;

  if not exists (
    select 1
    from public.household_members as member
    where member.household_id = p_household_id
      and member.user_id = p_actor_user_id
  ) then
    raise exception using errcode = '42501', message = 'household_forbidden';
  end if;

  if not exists (
    select 1
    from public.chef_conversations as conversation
    where conversation.id = p_conversation_id
      and conversation.household_id = p_household_id
  ) then
    raise exception using errcode = 'P0002', message = 'chef_conversation_not_found';
  end if;

  for v_row in
    with recursive chain as (
      select conversation.id, conversation.continued_from_id, 0 as depth,
        array[conversation.id]::uuid[] as path
      from public.chef_conversations as conversation
      where conversation.id = p_conversation_id
        and conversation.household_id = p_household_id

      union all

      select parent.id, parent.continued_from_id, chain.depth + 1,
        chain.path || parent.id
      from chain
      join public.chef_conversations as parent
        on parent.id = chain.continued_from_id
        and parent.household_id = p_household_id
      where chain.depth + 1 < p_max_depth
        and not parent.id = any(chain.path)
    )
    select turn.conversation_id, turn.id as turn_id, turn.created_at,
      turn.request_payload, turn.response_payload
    from chain
    join public.chef_conversation_turns as turn
      on turn.conversation_id = chain.id
      and turn.household_id = p_household_id
    order by turn.created_at desc, turn.id desc
  loop
    v_item := jsonb_build_object(
      'conversation_id', v_row.conversation_id,
      'turn_id', v_row.turn_id,
      'created_at', v_row.created_at,
      'request_payload', v_row.request_payload,
      'response_payload', v_row.response_payload
    );
    if v_chars + length(v_item::text) > p_max_chars then
      v_truncated := true;
      exit;
    end if;
    v_turns := jsonb_build_array(v_item) || v_turns;
    v_chars := v_chars + length(v_item::text);
  end loop;

  if exists (
    with recursive chain as (
      select conversation.id, conversation.continued_from_id, 0 as depth,
        array[conversation.id]::uuid[] as path
      from public.chef_conversations as conversation
      where conversation.id = p_conversation_id
        and conversation.household_id = p_household_id
      union all
      select parent.id, parent.continued_from_id, chain.depth + 1,
        chain.path || parent.id
      from chain
      join public.chef_conversations as parent
        on parent.id = chain.continued_from_id
        and parent.household_id = p_household_id
      where chain.depth + 1 < p_max_depth
        and not parent.id = any(chain.path)
    )
    select 1 from chain
    where depth = p_max_depth - 1 and continued_from_id is not null
  ) then
    v_truncated := true;
  end if;

  return jsonb_build_object(
    'schema_version', 1,
    'truncated', v_truncated,
    'turns', v_turns
  );
end;
$function$;

REVOKE ALL ON FUNCTION "public"."get_chef_conversation_context"(uuid, uuid, uuid, integer, integer) FROM PUBLIC, "anon", "authenticated";

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
    ) then
      if exists (
        select 1
        from public.ai_credit_refunds as refund
        where refund.request_id = p_client_request_id
      ) then
        return jsonb_build_object('schema_version', 1, 'status', 'refunded');
      end if;
      return jsonb_build_object('schema_version', 1, 'status', 'incomplete');
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

REVOKE ALL ON FUNCTION "public"."lookup_chef_exchange"(uuid, uuid, uuid, text) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.persist_chef_exchange (
  p_household_id                   uuid,
  p_actor_user_id                  uuid,
  p_conversation_id                uuid,
  p_continued_from_conversation_id uuid,
  p_client_request_id              uuid,
  p_request_fingerprint            text,
  p_request_payload                jsonb,
  p_user_text                      text,
  p_response_payload               jsonb,
  p_recipe_snapshots               jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_now timestamptz := now();
  v_lookup jsonb;
  v_conversation public.chef_conversations%rowtype;
  v_turn public.chef_conversation_turns%rowtype;
  v_snapshot jsonb;
  v_recipe public.chef_recipe_history%rowtype;
  v_hydration jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_client_request_id::text, 0));

  if not exists (
    select 1
    from public.household_members as member
    where member.household_id = p_household_id
      and member.user_id = p_actor_user_id
  ) then
    raise exception using errcode = '42501', message = 'household_forbidden';
  end if;

  if p_conversation_id is not null and p_continued_from_conversation_id is not null then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  if p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or length(trim(p_user_text)) not between 1 and 8000
    or jsonb_typeof(p_request_payload) <> 'object'
    or jsonb_typeof(p_response_payload) <> 'object'
    or jsonb_typeof(p_recipe_snapshots) <> 'array'
    or jsonb_array_length(p_recipe_snapshots) > 1
  then
    raise exception using errcode = '22023', message = 'chef_history_payload_invalid';
  end if;

  v_lookup := public.lookup_chef_exchange(
    p_household_id,
    p_actor_user_id,
    p_client_request_id,
    p_request_fingerprint
  );
  if v_lookup ->> 'status' = 'match' then
    return v_lookup -> 'hydration';
  end if;
  if v_lookup ->> 'status' = 'conflict' then
    raise exception using errcode = '40001', message = 'chef_request_replay_mismatch';
  end if;
  if v_lookup ->> 'status' = 'refunded' then
    raise exception using errcode = '40001', message = 'chef_request_already_refunded';
  end if;

  if p_conversation_id is not null then
    select conversation.*
    into v_conversation
    from public.chef_conversations as conversation
    where conversation.id = p_conversation_id
      and conversation.household_id = p_household_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'chef_conversation_not_found';
    end if;
    if exists (
      select 1
      from public.chef_conversations as child
      where child.continued_from_id = v_conversation.id
        and child.household_id = p_household_id
    ) then
      raise exception using errcode = '40001', message = 'chef_conversation_source_immutable';
    end if;
    if v_conversation.last_activity_at > v_now
      or v_now - v_conversation.last_activity_at > interval '48 hours'
    then
      raise exception using errcode = '40001', message = 'chef_conversation_continuation_expired';
    end if;
  elsif p_continued_from_conversation_id is not null then
    select conversation.*
    into v_conversation
    from public.chef_conversations as conversation
    where conversation.id = p_continued_from_conversation_id
      and conversation.household_id = p_household_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'chef_conversation_not_found';
    end if;
    if v_conversation.last_activity_at > v_now
      or v_now - v_conversation.last_activity_at > interval '48 hours'
    then
      raise exception using errcode = '40001', message = 'chef_conversation_continuation_expired';
    end if;

    insert into public.chef_conversations (
      household_id, created_by, created_at, last_activity_at, continued_from_id, updated_at
    ) values (
      p_household_id, p_actor_user_id, v_now, v_now,
      p_continued_from_conversation_id, v_now
    )
    returning * into v_conversation;
  else
    insert into public.chef_conversations (
      household_id, created_by, created_at, last_activity_at, updated_at
    ) values (
      p_household_id, p_actor_user_id, v_now, v_now, v_now
    )
    returning * into v_conversation;
  end if;

  insert into public.chef_conversation_turns (
    conversation_id,
    household_id,
    created_by,
    client_request_id,
    request_fingerprint,
    user_text,
    request_payload,
    response_payload,
    created_at
  ) values (
    v_conversation.id,
    p_household_id,
    p_actor_user_id,
    p_client_request_id,
    p_request_fingerprint,
    trim(p_user_text),
    p_request_payload,
    p_response_payload,
    v_now
  )
  returning * into v_turn;

  if p_conversation_id is not null then
    update public.chef_conversations as conversation
    set last_activity_at = v_now,
        updated_at = v_now
    where conversation.id = v_conversation.id
    returning conversation.* into v_conversation;
  end if;

  if jsonb_array_length(p_recipe_snapshots) = 1 then
    v_snapshot := p_recipe_snapshots -> 0;
    if jsonb_typeof(v_snapshot) <> 'object'
      or not v_snapshot ? 'title'
      or not v_snapshot ? 'recipe_payload'
      or (select count(*) from jsonb_object_keys(v_snapshot)) <> 2
      or jsonb_typeof(v_snapshot -> 'recipe_payload') <> 'object'
    then
      raise exception using errcode = '22023', message = 'chef_recipe_snapshot_invalid';
    end if;

    insert into public.chef_recipe_history (
      conversation_id, turn_id, household_id, title, recipe_payload, created_at
    ) values (
      v_conversation.id,
      v_turn.id,
      p_household_id,
      trim(v_snapshot ->> 'title'),
      v_snapshot -> 'recipe_payload',
      v_now
    )
    returning * into v_recipe;
  end if;

  v_hydration := jsonb_build_object(
    'schema_version', 1,
    'replayed', false,
    'conversation', jsonb_build_object(
      'id', v_conversation.id,
      'household_id', v_conversation.household_id,
      'created_by', v_conversation.created_by,
      'created_at', v_conversation.created_at,
      'last_activity_at', v_conversation.last_activity_at,
      'continued_from_id', v_conversation.continued_from_id,
      'updated_at', v_conversation.updated_at
    ),
    'turn', jsonb_build_object(
      'id', v_turn.id,
      'conversation_id', v_turn.conversation_id,
      'household_id', v_turn.household_id,
      'created_by', v_turn.created_by,
      'client_request_id', v_turn.client_request_id,
      'request_fingerprint', v_turn.request_fingerprint,
      'user_text', v_turn.user_text,
      'request_payload', v_turn.request_payload,
      'response_payload', v_turn.response_payload,
      'created_at', v_turn.created_at
    ),
    'recipe_history', case
      when v_recipe.id is null then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object(
        'id', v_recipe.id,
        'conversation_id', v_recipe.conversation_id,
        'turn_id', v_recipe.turn_id,
        'household_id', v_recipe.household_id,
        'title', v_recipe.title,
        'recipe_payload', v_recipe.recipe_payload,
        'created_at', v_recipe.created_at
      ))
    end
  );

  return v_hydration;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."persist_chef_exchange"(uuid, uuid, uuid, uuid, uuid, text, jsonb, text, jsonb, jsonb) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.preflight_chef_exchange (
  p_household_id                   uuid,
  p_actor_user_id                  uuid,
  p_conversation_id                uuid,
  p_continued_from_conversation_id uuid
)
  RETURNS TABLE (
    allowed          boolean,
    error_code       text,
    conversation_id  uuid,
    last_activity_at timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_conversation public.chef_conversations%rowtype;
  v_requested_id uuid;
begin
  if not exists (
    select 1
    from public.household_members as member
    where member.household_id = p_household_id
      and member.user_id = p_actor_user_id
  ) then
    return query select false, 'household_forbidden'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if p_conversation_id is not null and p_continued_from_conversation_id is not null then
    return query select false, 'invalid_request'::text, null::uuid, null::timestamptz;
    return;
  end if;

  v_requested_id := coalesce(p_conversation_id, p_continued_from_conversation_id);
  if v_requested_id is null then
    return query select true, null::text, null::uuid, null::timestamptz;
    return;
  end if;

  select conversation.*
  into v_conversation
  from public.chef_conversations as conversation
  where conversation.id = v_requested_id
    and conversation.household_id = p_household_id;

  if not found then
    return query select false, 'chef_conversation_not_found'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if p_conversation_id is not null and exists (
    select 1
    from public.chef_conversations as child
    where child.continued_from_id = v_conversation.id
      and child.household_id = p_household_id
  ) then
    return query select false, 'chef_conversation_source_immutable'::text,
      v_conversation.id, v_conversation.last_activity_at;
    return;
  end if;

  if v_conversation.last_activity_at > now()
    or now() - v_conversation.last_activity_at > interval '48 hours'
  then
    return query select false, 'chef_conversation_continuation_expired'::text,
      v_conversation.id, v_conversation.last_activity_at;
    return;
  end if;

  return query select true, null::text, v_conversation.id, v_conversation.last_activity_at;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."preflight_chef_exchange"(uuid, uuid, uuid, uuid) FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."chef_conversation_turns"
  ADD CONSTRAINT "chef_conversation_turns_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."chef_conversation_turns"
  ADD CONSTRAINT "chef_conversation_turns_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE "public"."chef_conversations"
  ADD CONSTRAINT "chef_conversations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."chef_conversations"
  ADD CONSTRAINT "chef_conversations_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE "public"."chef_conversation_turns"
  ADD CONSTRAINT "chef_turns_conversation_household_fkey" FOREIGN KEY (conversation_id, household_id) REFERENCES public.chef_conversations(id, household_id) ON DELETE CASCADE;

ALTER TABLE "public"."chef_conversations"
  ADD CONSTRAINT "chef_conversations_parent_household_fkey" FOREIGN KEY (continued_from_id, household_id) REFERENCES public.chef_conversations(id, household_id) ON DELETE CASCADE;

ALTER TABLE "public"."chef_recipe_history"
  ADD CONSTRAINT "chef_recipe_history_conversation_household_fkey" FOREIGN KEY (conversation_id, household_id) REFERENCES public.chef_conversations(id, household_id)
    ON DELETE CASCADE;

ALTER TABLE "public"."chef_recipe_history"
  ADD CONSTRAINT "chef_recipe_history_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE "public"."chef_recipe_history"
  ADD CONSTRAINT "chef_recipe_history_turn_household_fkey" FOREIGN KEY (turn_id, conversation_id, household_id)
    REFERENCES public.chef_conversation_turns(id, conversation_id, household_id) ON DELETE CASCADE;

CREATE UNIQUE INDEX ai_credit_bookings_request_idx ON public.ai_credit_bookings USING btree (request_id);

CREATE INDEX chef_conversations_household_activity_idx ON public.chef_conversations USING btree (household_id, last_activity_at DESC, id);

CREATE INDEX chef_conversations_household_updated_idx ON public.chef_conversations USING btree (household_id, updated_at, id);

CREATE INDEX chef_conversations_parent_idx ON public.chef_conversations USING btree (continued_from_id)
  WHERE (continued_from_id IS NOT NULL);

CREATE INDEX chef_recipe_history_conversation_created_idx ON public.chef_recipe_history USING btree (conversation_id, created_at, id);

CREATE INDEX chef_recipe_history_household_created_idx ON public.chef_recipe_history USING btree (household_id, created_at, id);

CREATE INDEX chef_turns_conversation_created_idx ON public.chef_conversation_turns USING btree (conversation_id, created_at, id);

CREATE INDEX chef_turns_household_created_idx ON public.chef_conversation_turns USING btree (household_id, created_at, id);

CREATE TRIGGER chef_conversations_set_updated_at
  BEFORE UPDATE ON public.chef_conversations
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY "chef_turns_select_member" ON "public"."chef_conversation_turns"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.is_household_member(chef_conversation_turns.household_id) AS is_household_member));

CREATE POLICY "chef_conversations_select_member" ON "public"."chef_conversations"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.is_household_member(chef_conversations.household_id) AS is_household_member));

CREATE POLICY "chef_recipe_history_select_member" ON "public"."chef_recipe_history"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.is_household_member(chef_recipe_history.household_id) AS is_household_member));

REVOKE ALL ON FUNCTION "public"."book_ai_credit"(uuid, text, uuid, integer, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."book_ai_credit"(uuid, text, uuid, integer, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."book_ai_credit"(uuid, text, uuid, integer, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_chef_conversation_context"(uuid, uuid, uuid, integer, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_chef_conversation_context"(uuid, uuid, uuid, integer, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_chef_conversation_context"(uuid, uuid, uuid, integer, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."lookup_chef_exchange"(uuid, uuid, uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."lookup_chef_exchange"(uuid, uuid, uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."lookup_chef_exchange"(uuid, uuid, uuid, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."persist_chef_exchange"(uuid, uuid, uuid, uuid, uuid, text, jsonb, text, jsonb, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."persist_chef_exchange"(uuid, uuid, uuid, uuid, uuid, text, jsonb, text, jsonb, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."persist_chef_exchange"(uuid, uuid, uuid, uuid, uuid, text, jsonb, text, jsonb, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."preflight_chef_exchange"(uuid, uuid, uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."preflight_chef_exchange"(uuid, uuid, uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."preflight_chef_exchange"(uuid, uuid, uuid, uuid) TO "service_role";

REVOKE ALL ON TABLE "public"."chef_conversation_turns" FROM "authenticated";

GRANT SELECT ON TABLE "public"."chef_conversation_turns" TO "authenticated";

REVOKE ALL ON TABLE "public"."chef_conversations" FROM "authenticated";

GRANT SELECT ON TABLE "public"."chef_conversations" TO "authenticated";

REVOKE ALL ON TABLE "public"."chef_recipe_history" FROM "authenticated";

GRANT SELECT ON TABLE "public"."chef_recipe_history" TO "authenticated";
