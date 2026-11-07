-- Chef-Koch-History ist servererzeugter Haushalt-Content. Mobile Clients lesen
-- die Tabellen per RLS, schreiben aber ausschliesslich ueber den AI-Gateway.

create table if not exists public.chef_conversations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  continued_from_id uuid,
  updated_at timestamptz not null default now(),

  unique (id, household_id),
  constraint chef_conversations_parent_not_self
    check (continued_from_id is null or continued_from_id <> id),
  constraint chef_conversations_parent_household_fkey
    foreign key (continued_from_id, household_id)
    references public.chef_conversations (id, household_id)
    on delete cascade
);

create index if not exists chef_conversations_household_activity_idx
  on public.chef_conversations (household_id, last_activity_at desc, id);
create index if not exists chef_conversations_household_updated_idx
  on public.chef_conversations (household_id, updated_at, id);
create index if not exists chef_conversations_parent_idx
  on public.chef_conversations (continued_from_id)
  where continued_from_id is not null;

create or replace trigger chef_conversations_set_updated_at
  before update on public.chef_conversations
  for each row execute function private.set_updated_at();

create table if not exists public.chef_conversation_turns (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  client_request_id uuid not null unique,
  request_fingerprint text not null,
  user_text text not null,
  request_payload jsonb not null,
  response_payload jsonb not null,
  created_at timestamptz not null default now(),

  unique (id, conversation_id, household_id),
  constraint chef_turns_conversation_household_fkey
    foreign key (conversation_id, household_id)
    references public.chef_conversations (id, household_id)
    on delete cascade,
  constraint chef_turns_fingerprint_check
    check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint chef_turns_user_text_check
    check (length(trim(user_text)) between 1 and 8000),
  constraint chef_turns_request_payload_check
    check (
      jsonb_typeof(request_payload) = 'object'
      and request_payload ->> 'schema_version' = '1'
      and octet_length(request_payload::text) <= 65536
    ),
  constraint chef_turns_response_payload_check
    check (
      jsonb_typeof(response_payload) = 'object'
      and response_payload ->> 'schema_version' = '1'
      and octet_length(response_payload::text) <= 262144
    )
);

create index if not exists chef_turns_household_created_idx
  on public.chef_conversation_turns (household_id, created_at, id);
create index if not exists chef_turns_conversation_created_idx
  on public.chef_conversation_turns (conversation_id, created_at, id);

-- Ein Eintrag bildet eine vollstaendige erfolgreiche Rezeptantwort ab. Mehrere
-- Mahlzeiten bleiben zusammen in recipe_payload; reine Shopping-Fragen haben
-- keinen Eintrag in dieser Tabelle.
create table if not exists public.chef_recipe_history (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  turn_id uuid not null unique,
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  recipe_payload jsonb not null,
  created_at timestamptz not null default now(),

  unique (id, household_id),
  constraint chef_recipe_history_conversation_household_fkey
    foreign key (conversation_id, household_id)
    references public.chef_conversations (id, household_id)
    on delete cascade,
  constraint chef_recipe_history_turn_household_fkey
    foreign key (turn_id, conversation_id, household_id)
    references public.chef_conversation_turns (id, conversation_id, household_id)
    on delete cascade,
  constraint chef_recipe_history_title_check
    check (length(trim(title)) between 1 and 8000),
  constraint chef_recipe_history_payload_check
    check (
      jsonb_typeof(recipe_payload) = 'object'
      and recipe_payload ->> 'schema_version' = '1'
      and octet_length(recipe_payload::text) <= 262144
    )
);

create index if not exists chef_recipe_history_household_created_idx
  on public.chef_recipe_history (household_id, created_at, id);
create index if not exists chef_recipe_history_conversation_created_idx
  on public.chef_recipe_history (conversation_id, created_at, id);

alter table public.chef_conversations enable row level security;
alter table public.chef_conversation_turns enable row level security;
alter table public.chef_recipe_history enable row level security;

create policy chef_conversations_select_member on public.chef_conversations
  for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy chef_turns_select_member on public.chef_conversation_turns
  for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy chef_recipe_history_select_member on public.chef_recipe_history
  for select to authenticated
  using ((select private.is_household_member(household_id)));

-- Sucht eine bereits gespeicherte Client-Anfrage. Ein Konflikt gibt niemals
-- fremde History-Inhalte zurueck.
create or replace function public.lookup_chef_exchange(
  p_household_id uuid,
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_request_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- Prueft eine neue Conversation, einen Append oder eine Fortsetzung vor
-- Entitlement, Credit und Provider. Die Persistenz wiederholt die Pruefung
-- unter dem Zeilen-Lock.
create or replace function public.preflight_chef_exchange(
  p_household_id uuid,
  p_actor_user_id uuid,
  p_conversation_id uuid,
  p_continued_from_conversation_id uuid
)
returns table (
  allowed boolean,
  error_code text,
  conversation_id uuid,
  last_activity_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- Laedt ausschliesslich serverseitig gespeicherte, haushaltsgepruefte Turns.
-- Die Ausgabe ist fuer den Provider begrenzt; die gespeicherte History bleibt
-- vollstaendig.
create or replace function public.get_chef_conversation_context(
  p_household_id uuid,
  p_actor_user_id uuid,
  p_conversation_id uuid,
  p_max_depth integer default 20,
  p_max_chars integer default 32000
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
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
$$;

-- Validiert die Version-1-Rezeptantwort, die der Mobile-Vertrag hydratisiert.
create or replace function private.chef_recipe_response_is_valid(p_response jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_meal jsonb;
  v_item jsonb;
  v_key_count integer;
begin
  if p_response is null
    or pg_catalog.jsonb_typeof(p_response) is distinct from 'object'
  then
    return false;
  end if;

  select count(*) into v_key_count from pg_catalog.jsonb_object_keys(p_response);
  if v_key_count <> 2
    or not (p_response ?& array['schema_version', 'meals'])
    or pg_catalog.jsonb_typeof(p_response -> 'schema_version') is distinct from 'number'
    or p_response ->> 'schema_version' <> '1'
    or pg_catalog.jsonb_typeof(p_response -> 'meals') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_response -> 'meals') not between 1 and 3
  then
    return false;
  end if;

  for v_meal in
    select value from pg_catalog.jsonb_array_elements(p_response -> 'meals') as meal(value)
  loop
    if pg_catalog.jsonb_typeof(v_meal) is distinct from 'object' then
      return false;
    end if;

    select count(*) into v_key_count from pg_catalog.jsonb_object_keys(v_meal);
    if v_key_count not in (8, 9)
      or not (v_meal ?& array[
        'title', 'source', 'recipe_id', 'servings', 'used_items',
        'additional_ingredients', 'steps', 'notes'
      ])
      or (v_key_count = 8 and (v_meal ? 'shopping_needs'))
      or (v_key_count = 9 and not (v_meal ? 'shopping_needs'))
      or pg_catalog.jsonb_typeof(v_meal -> 'title') is distinct from 'string'
      or pg_catalog.btrim(v_meal ->> 'title') = ''
      or pg_catalog.jsonb_typeof(v_meal -> 'source') is distinct from 'string'
      or v_meal ->> 'source' not in ('catalog', 'template', 'model_generated')
      or pg_catalog.jsonb_typeof(v_meal -> 'recipe_id') not in ('null', 'string')
      or (
        pg_catalog.jsonb_typeof(v_meal -> 'recipe_id') = 'string'
        and pg_catalog.btrim(v_meal ->> 'recipe_id') = ''
      )
      or (
        v_meal ->> 'source' = 'model_generated'
        and pg_catalog.jsonb_typeof(v_meal -> 'recipe_id') is distinct from 'null'
      )
      or (
        v_meal ->> 'source' <> 'model_generated'
        and pg_catalog.jsonb_typeof(v_meal -> 'recipe_id') is distinct from 'string'
      )
      or pg_catalog.jsonb_typeof(v_meal -> 'servings') is distinct from 'number'
      or (v_meal ->> 'servings')::numeric <= 0
      or trunc((v_meal ->> 'servings')::numeric) <> (v_meal ->> 'servings')::numeric
      or pg_catalog.jsonb_typeof(v_meal -> 'used_items') is distinct from 'array'
      or pg_catalog.jsonb_typeof(v_meal -> 'additional_ingredients') is distinct from 'array'
      or pg_catalog.jsonb_array_length(v_meal -> 'additional_ingredients') > 2
      or pg_catalog.jsonb_typeof(v_meal -> 'steps') is distinct from 'array'
      or pg_catalog.jsonb_array_length(v_meal -> 'steps') < 1
      or pg_catalog.jsonb_typeof(v_meal -> 'notes') is distinct from 'array'
    then
      return false;
    end if;

    for v_item in
      select value from pg_catalog.jsonb_array_elements(v_meal -> 'used_items') as item(value)
    loop
      if pg_catalog.jsonb_typeof(v_item) is distinct from 'object' then
        return false;
      end if;
      select count(*) into v_key_count from pg_catalog.jsonb_object_keys(v_item);
      if v_key_count <> 3
        or not (v_item ?& array['inventory_item_id', 'quantity', 'unit'])
        or pg_catalog.jsonb_typeof(v_item -> 'inventory_item_id') is distinct from 'string'
        or pg_catalog.btrim(v_item ->> 'inventory_item_id') = ''
        or pg_catalog.jsonb_typeof(v_item -> 'quantity') is distinct from 'number'
        or (v_item ->> 'quantity')::numeric <= 0
        or pg_catalog.jsonb_typeof(v_item -> 'unit') is distinct from 'string'
        or pg_catalog.btrim(v_item ->> 'unit') = ''
      then
        return false;
      end if;
    end loop;

    if v_meal ? 'shopping_needs' then
      if pg_catalog.jsonb_typeof(v_meal -> 'shopping_needs') is distinct from 'array' then
        return false;
      end if;
      for v_item in
        select value
        from pg_catalog.jsonb_array_elements(v_meal -> 'shopping_needs') as item(value)
      loop
        if pg_catalog.jsonb_typeof(v_item) is distinct from 'object' then
          return false;
        end if;
        select count(*) into v_key_count from pg_catalog.jsonb_object_keys(v_item);
        if v_key_count <> 3
          or not (v_item ?& array['name', 'quantity', 'unit'])
          or pg_catalog.jsonb_typeof(v_item -> 'name') is distinct from 'string'
          or pg_catalog.btrim(v_item ->> 'name') = ''
          or pg_catalog.jsonb_typeof(v_item -> 'quantity') is distinct from 'number'
          or (v_item ->> 'quantity')::numeric <= 0
          or pg_catalog.jsonb_typeof(v_item -> 'unit') is distinct from 'string'
          or pg_catalog.btrim(v_item ->> 'unit') = ''
        then
          return false;
        end if;
      end loop;
    end if;

    for v_item in
      select value
      from pg_catalog.jsonb_array_elements(v_meal -> 'additional_ingredients') as item(value)
    loop
      if pg_catalog.jsonb_typeof(v_item) is distinct from 'string'
        or pg_catalog.btrim(v_item #>> '{}') = ''
      then
        return false;
      end if;
    end loop;

    for v_item in
      select value from pg_catalog.jsonb_array_elements(v_meal -> 'steps') as item(value)
    loop
      if pg_catalog.jsonb_typeof(v_item) is distinct from 'string'
        or pg_catalog.btrim(v_item #>> '{}') = ''
      then
        return false;
      end if;
    end loop;

    for v_item in
      select value from pg_catalog.jsonb_array_elements(v_meal -> 'notes') as item(value)
    loop
      if pg_catalog.jsonb_typeof(v_item) is distinct from 'string' then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

-- Persistiert Conversation, sichtbaren Turn und optional genau einen
-- response-level Rezept-Snapshot atomar.
create or replace function public.persist_chef_exchange(
  p_household_id uuid,
  p_actor_user_id uuid,
  p_conversation_id uuid,
  p_continued_from_conversation_id uuid,
  p_client_request_id uuid,
  p_request_fingerprint text,
  p_request_payload jsonb,
  p_user_text text,
  p_response_payload jsonb,
  p_recipe_snapshots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_lookup jsonb;
  v_conversation public.chef_conversations%rowtype;
  v_turn public.chef_conversation_turns%rowtype;
  v_snapshot jsonb;
  v_snapshot_item jsonb;
  v_recipe public.chef_recipe_history%rowtype;
  v_hydration jsonb;
  v_request_key_count integer;
  v_response_key_count integer;
  v_recipe_snapshot_count integer;
  v_snapshot_key_count integer;
  v_recipe_payload_key_count integer;
  v_snapshot_item_key_count integer;
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
    or (
      jsonb_typeof(p_response_payload -> 'result') = 'object'
      and not private.chef_recipe_response_is_valid(p_response_payload -> 'result')
    )
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
      or v_snapshot -> 'recipe_payload' -> 'response' is distinct from p_response_payload -> 'result'
      or v_snapshot -> 'recipe_payload' -> 'response' ->> 'schema_version' <> '1'
      or not (v_snapshot -> 'recipe_payload' -> 'response') ? 'meals'
      or jsonb_typeof(v_snapshot -> 'recipe_payload' -> 'response' -> 'meals') is distinct from 'array'
      or jsonb_typeof(v_snapshot -> 'recipe_payload' -> 'used_item_snapshots') <> 'array'
    then
      raise exception using errcode = '22023', message = 'chef_recipe_snapshot_invalid';
    end if;

    for v_snapshot_item in
      select value
      from jsonb_array_elements(v_snapshot -> 'recipe_payload' -> 'used_item_snapshots') as item(value)
    loop
      if jsonb_typeof(v_snapshot_item) is distinct from 'object' then
        raise exception using errcode = '22023', message = 'chef_recipe_snapshot_invalid';
      end if;
      select count(*) into v_snapshot_item_key_count
      from jsonb_object_keys(v_snapshot_item);
      if v_snapshot_item_key_count <> 4
        or not v_snapshot_item ?& array[
          'inventory_item_id', 'name', 'quantity', 'unit'
        ]
        or jsonb_typeof(v_snapshot_item -> 'inventory_item_id') is distinct from 'string'
        or length(trim(v_snapshot_item ->> 'inventory_item_id')) = 0
        or jsonb_typeof(v_snapshot_item -> 'name') is distinct from 'string'
        or length(trim(v_snapshot_item ->> 'name')) = 0
        or jsonb_typeof(v_snapshot_item -> 'quantity') is distinct from 'number'
        or (v_snapshot_item ->> 'quantity')::numeric <= 0
        or jsonb_typeof(v_snapshot_item -> 'unit') is distinct from 'string'
        or length(trim(v_snapshot_item ->> 'unit')) = 0
      then
        raise exception using errcode = '22023', message = 'chef_recipe_snapshot_invalid';
      end if;
    end loop;

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
$$;
