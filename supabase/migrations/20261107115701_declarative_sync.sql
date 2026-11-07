SET local check_function_bodies = off;

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
  v_request_key_count integer;
  v_response_key_count integer;
  v_recipe_snapshot_count integer;
  v_snapshot_key_count integer;
  v_recipe_payload_key_count integer;
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

  if jsonb_typeof(p_request_payload) = 'object' then
    select count(*) into v_request_key_count from jsonb_object_keys(p_request_payload);
  else
    v_request_key_count := 0;
  end if;
  if jsonb_typeof(p_response_payload) = 'object' then
    select count(*) into v_response_key_count from jsonb_object_keys(p_response_payload);
  else
    v_response_key_count := 0;
  end if;
  if jsonb_typeof(p_recipe_snapshots) = 'array' then
    v_recipe_snapshot_count := jsonb_array_length(p_recipe_snapshots);
  else
    v_recipe_snapshot_count := 0;
  end if;

  if p_request_fingerprint is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_user_text is null
    or length(trim(p_user_text)) not between 1 and 8000
    or jsonb_typeof(p_request_payload) is distinct from 'object'
    or p_request_payload ->> 'schema_version' <> '1'
    or jsonb_typeof(p_request_payload -> 'schema_version') is distinct from 'number'
    or not p_request_payload ?& array[
      'schema_version', 'user_text', 'servings', 'max_minutes',
      'dietary_pattern', 'shopping_decision', 'selected_inventory_item_ids'
    ]
    or jsonb_typeof(p_request_payload -> 'user_text') is distinct from 'string'
    or p_request_payload ->> 'user_text' <> trim(p_user_text)
    or jsonb_typeof(p_request_payload -> 'servings') not in ('null', 'number')
    or jsonb_typeof(p_request_payload -> 'max_minutes') not in ('null', 'number')
    or jsonb_typeof(p_request_payload -> 'dietary_pattern') not in ('null', 'string')
    or jsonb_typeof(p_request_payload -> 'shopping_decision') not in ('null', 'string')
    or jsonb_typeof(p_request_payload -> 'selected_inventory_item_ids') is distinct from 'array'
    or jsonb_typeof(p_response_payload) is distinct from 'object'
    or p_response_payload ->> 'schema_version' <> '1'
    or jsonb_typeof(p_response_payload -> 'schema_version') is distinct from 'number'
    or not p_response_payload ?& array[
      'schema_version', 'skill', 'model', 'generated_at',
      'priority_food_count', 'shopping_question', 'result'
    ]
    or p_response_payload ->> 'skill' <> 'fam-cook-from-inventory'
    or jsonb_typeof(p_response_payload -> 'skill') is distinct from 'string'
    or jsonb_typeof(p_response_payload -> 'model') is distinct from 'string'
    or jsonb_typeof(p_response_payload -> 'generated_at') is distinct from 'string'
    or jsonb_typeof(p_response_payload -> 'priority_food_count') is distinct from 'number'
    or jsonb_typeof(p_recipe_snapshots) is distinct from 'array'
    or v_request_key_count <> 7
    or v_response_key_count <> 7
    or v_recipe_snapshot_count > 1
  then
    raise exception using errcode = '22023', message = 'chef_history_payload_invalid';
  end if;

  if not p_response_payload ? 'result'
    or not p_response_payload ? 'shopping_question'
    or jsonb_typeof(p_response_payload -> 'result') not in ('null', 'object')
    or jsonb_typeof(p_response_payload -> 'shopping_question') not in ('null', 'string')
  then
    raise exception using errcode = '22023', message = 'chef_history_payload_invalid';
  end if;

  if jsonb_typeof(p_response_payload -> 'result') = 'null'
    and jsonb_array_length(p_recipe_snapshots) <> 0
  then
    raise exception using errcode = '22023', message = 'chef_history_payload_invalid';
  end if;

  if jsonb_typeof(p_response_payload -> 'result') = 'object'
    and jsonb_array_length(p_recipe_snapshots) <> 1
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
    if jsonb_typeof(v_snapshot) = 'object' then
      select count(*) into v_snapshot_key_count from jsonb_object_keys(v_snapshot);
    else
      v_snapshot_key_count := 0;
    end if;
    if jsonb_typeof(v_snapshot -> 'recipe_payload') = 'object' then
      select count(*) into v_recipe_payload_key_count
      from jsonb_object_keys(v_snapshot -> 'recipe_payload');
    else
      v_recipe_payload_key_count := 0;
    end if;
    if jsonb_typeof(v_snapshot) <> 'object'
      or not v_snapshot ?& array['title', 'recipe_payload']
      or v_snapshot_key_count <> 2
      or jsonb_typeof(v_snapshot -> 'title') <> 'string'
      or length(trim(v_snapshot ->> 'title')) not between 1 and 8000
      or jsonb_typeof(v_snapshot -> 'recipe_payload') <> 'object'
      or v_snapshot -> 'recipe_payload' ->> 'schema_version' <> '1'
      or jsonb_typeof(v_snapshot -> 'recipe_payload' -> 'schema_version') is distinct from 'number'
      or not (v_snapshot -> 'recipe_payload') ?& array[
        'schema_version', 'response', 'used_item_snapshots'
      ]
      or v_recipe_payload_key_count <> 3
      or jsonb_typeof(v_snapshot -> 'recipe_payload' -> 'response') is distinct from 'object'
      or v_snapshot -> 'recipe_payload' -> 'response' ->> 'schema_version' <> '1'
      or not (v_snapshot -> 'recipe_payload' -> 'response') ? 'meals'
      or jsonb_typeof(v_snapshot -> 'recipe_payload' -> 'response' -> 'meals') is distinct from 'array'
      or jsonb_typeof(v_snapshot -> 'recipe_payload' -> 'used_item_snapshots') <> 'array'
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
