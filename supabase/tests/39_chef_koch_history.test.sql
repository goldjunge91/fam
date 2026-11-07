-- Chef-Koch-History: Haushaltssichtbarkeit, kontrollierte Writes und Retention.

begin;
\ir helpers.sql

select no_plan();

select tests.create_user('81000000-0000-4000-8000-000000000001', 'chef-alice@example.com');
select tests.create_user('81000000-0000-4000-8000-000000000002', 'chef-bob@example.com');
select tests.create_user('81000000-0000-4000-8000-000000000003', 'chef-mallory@example.com');

select tests.authenticate_as('81000000-0000-4000-8000-000000000001');
select public.create_household('Chef Haushalt Eins') as household_one \gset
select tests.authenticate_as('81000000-0000-4000-8000-000000000003');
select public.create_household('Chef Haushalt Zwei') as household_two \gset
select tests.as_postgres();

insert into public.household_members (household_id, user_id, role)
values (:'household_one', '81000000-0000-4000-8000-000000000002', 'member');

select has_table('public', 'chef_conversations', 'Chef-Conversations existieren');
select has_table('public', 'chef_conversation_turns', 'Chef-Turns existieren');
select has_table('public', 'chef_recipe_history', 'Chef-Rezept-History existiert');

select ok(
  (
    select bool_and(class.relrowsecurity)
    from pg_class as class
    where class.oid = any(array[
      'public.chef_conversations'::regclass,
      'public.chef_conversation_turns'::regclass,
      'public.chef_recipe_history'::regclass
    ])
  ),
  'RLS ist auf allen Chef-History-Tabellen aktiv'
);

select ok(
  (
    select bool_and(
      has_table_privilege('authenticated', table_name::regclass, 'select')
      and not has_table_privilege('authenticated', table_name::regclass, 'insert')
      and not has_table_privilege('authenticated', table_name::regclass, 'update')
      and not has_table_privilege('authenticated', table_name::regclass, 'delete')
      and not has_table_privilege('authenticated', table_name::regclass, 'truncate')
    )
    from unnest(array[
      'public.chef_conversations',
      'public.chef_conversation_turns',
      'public.chef_recipe_history'
    ]) as tables(table_name)
  ),
  'authenticated darf History lesen, aber nicht direkt veraendern'
);

select ok(
  (
    select bool_and(
      not has_table_privilege('service_role', table_name::regclass, 'insert')
      and not has_table_privilege('service_role', table_name::regclass, 'update')
      and not has_table_privilege('service_role', table_name::regclass, 'delete')
      and not has_table_privilege('service_role', table_name::regclass, 'truncate')
    )
    from unnest(array[
      'public.chef_conversations',
      'public.chef_conversation_turns',
      'public.chef_recipe_history'
    ]) as tables(table_name)
  ),
  'service_role besitzt keinen direkten History-Schreibpfad'
);

select ok(
  (
    select bool_and(
      not has_table_privilege('anon', table_name::regclass, 'insert')
      and not has_table_privilege('anon', table_name::regclass, 'update')
      and not has_table_privilege('anon', table_name::regclass, 'delete')
      and not has_table_privilege('anon', table_name::regclass, 'truncate')
    )
    from unnest(array[
      'public.chef_conversations',
      'public.chef_conversation_turns',
      'public.chef_recipe_history'
    ]) as tables(table_name)
  ),
  'anon besitzt keinen direkten History-Schreibpfad'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.lookup_chef_exchange(uuid,uuid,uuid,text)',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'public.lookup_chef_exchange(uuid,uuid,uuid,text)',
    'execute'
  ) and has_function_privilege(
    'service_role',
    'public.preflight_chef_exchange(uuid,uuid,uuid,uuid)',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'public.preflight_chef_exchange(uuid,uuid,uuid,uuid)',
    'execute'
  ),
  'Lookup und Preflight sind ausschliesslich serverseitig aufrufbar'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.get_chef_conversation_context(uuid,uuid,uuid,integer,integer)',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'public.get_chef_conversation_context(uuid,uuid,uuid,integer,integer)',
    'execute'
  ) and has_function_privilege(
    'service_role',
    'public.persist_chef_exchange(uuid,uuid,uuid,uuid,uuid,text,jsonb,text,jsonb,jsonb)',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'public.persist_chef_exchange(uuid,uuid,uuid,uuid,uuid,text,jsonb,text,jsonb,jsonb)',
    'execute'
  ),
  'Context und Persistenz sind ausschliesslich serverseitig aufrufbar'
);

set local role service_role;
create temporary table chef_test_hydrations (
  name text primary key,
  hydration jsonb not null
) on commit drop;

insert into chef_test_hydrations (name, hydration)
select 'source', public.persist_chef_exchange(
  :'household_one'::uuid,
  '81000000-0000-4000-8000-000000000001'::uuid,
  null,
  null,
  '82000000-0000-4000-8000-000000000001'::uuid,
  repeat('a', 64),
  jsonb_build_object(
    'schema_version', 1,
    'user_text', 'Was soll ich kochen?',
    'servings', 2,
    'max_minutes', null,
    'dietary_pattern', null,
    'shopping_decision', null,
    'selected_inventory_item_ids', jsonb_build_array('83000000-0000-4000-8000-000000000001')
  ),
  'Was soll ich kochen?',
  jsonb_build_object(
    'schema_version', 1,
    'skill', 'fam-cook-from-inventory',
    'model', 'test-model',
    'generated_at', now(),
    'priority_food_count', 1,
    'shopping_question', null,
    'result', jsonb_build_object(
      'schema_version', 1,
      'meals', jsonb_build_array(
        jsonb_build_object(
          'title', 'Tomatenpfanne',
          'source', 'catalog',
          'recipe_id', 'recipe-1',
          'servings', 2,
          'used_items', jsonb_build_array(
            jsonb_build_object(
              'inventory_item_id', '83000000-0000-4000-8000-000000000001',
              'quantity', 1,
              'unit', 'piece'
            )
          ),
          'additional_ingredients', '[]'::jsonb,
          'steps', jsonb_build_array('Garen.'),
          'notes', '[]'::jsonb
        ),
        jsonb_build_object(
          'title', 'Tomatensuppe',
          'source', 'model_generated',
          'recipe_id', null,
          'servings', 2,
          'used_items', jsonb_build_array(
            jsonb_build_object(
              'inventory_item_id', '83000000-0000-4000-8000-000000000001',
              'quantity', 1,
              'unit', 'piece'
            )
          ),
          'additional_ingredients', '[]'::jsonb,
          'steps', jsonb_build_array('Kochen.'),
          'notes', '[]'::jsonb
        )
      )
    )
  ),
  jsonb_build_array(jsonb_build_object(
    'title', 'Tomatenpfanne und Tomatensuppe',
    'recipe_payload', jsonb_build_object(
      'schema_version', 1,
      'response', jsonb_build_object(
        'schema_version', 1,
        'meals', jsonb_build_array(
          jsonb_build_object(
            'title', 'Tomatenpfanne',
            'source', 'catalog',
            'recipe_id', 'recipe-1',
            'servings', 2,
            'used_items', jsonb_build_array(
              jsonb_build_object(
                'inventory_item_id', '83000000-0000-4000-8000-000000000001',
                'quantity', 1,
                'unit', 'piece'
              )
            ),
            'additional_ingredients', '[]'::jsonb,
            'steps', jsonb_build_array('Garen.'),
            'notes', '[]'::jsonb
          ),
          jsonb_build_object(
            'title', 'Tomatensuppe',
            'source', 'model_generated',
            'recipe_id', null,
            'servings', 2,
            'used_items', jsonb_build_array(
              jsonb_build_object(
                'inventory_item_id', '83000000-0000-4000-8000-000000000001',
                'quantity', 1,
                'unit', 'piece'
              )
            ),
            'additional_ingredients', '[]'::jsonb,
            'steps', jsonb_build_array('Kochen.'),
            'notes', '[]'::jsonb
          )
        )
      ),
      'used_item_snapshots', jsonb_build_array(
        jsonb_build_object(
          'inventory_item_id', '83000000-0000-4000-8000-000000000001',
          'name', 'Tomate',
          'quantity', 1,
          'unit', 'piece'
        )
      )
    )
  ))
);
reset role;

select is(
  (select count(*)::int from public.chef_conversations where household_id = :'household_one'),
  1,
  'der erste erfolgreiche Exchange erzeugt genau eine Conversation'
);
select is(
  (select count(*)::int from public.chef_conversation_turns where household_id = :'household_one'),
  1,
  'der erste erfolgreiche Exchange erzeugt genau einen Turn'
);
select is(
  (select count(*)::int from public.chef_recipe_history where household_id = :'household_one'),
  1,
  'eine Antwort mit mehreren Mahlzeiten erzeugt einen response-level Snapshot'
);
select is(
  (select jsonb_array_length(recipe_payload #> '{response,meals}')
   from public.chef_recipe_history where household_id = :'household_one'),
  2,
  'der Snapshot erhaelt alle Mahlzeiten derselben Antwort'
);
select ok(
  (select recipe.recipe_payload -> 'response' = turn.response_payload -> 'result'
   from public.chef_recipe_history as recipe
   join public.chef_conversation_turns as turn on turn.id = recipe.turn_id
   where recipe.household_id = :'household_one'),
  'der persistierte Rezept-Response entspricht exakt dem validierten Gateway-Ergebnis'
);
select ok(
  (select not (hydration ? 'usage') from chef_test_hydrations where name = 'source'),
  'die Hydration enthaelt keine Provider-Usage'
);

set local role postgres;
select throws_ok(
  format(
    $$ select public.persist_chef_exchange(
      %L::uuid,
      '81000000-0000-4000-8000-000000000001'::uuid,
      null,
      null,
      '82000000-0000-4000-8000-000000000010'::uuid,
      repeat('f', 64),
      (select request_payload from public.chef_conversation_turns
       where client_request_id = '82000000-0000-4000-8000-000000000001'),
      (select user_text from public.chef_conversation_turns
       where client_request_id = '82000000-0000-4000-8000-000000000001'),
      (select response_payload from public.chef_conversation_turns
       where client_request_id = '82000000-0000-4000-8000-000000000001'),
      jsonb_build_array(jsonb_build_object(
        'title', 'Unvollstaendiger Snapshot',
        'recipe_payload', jsonb_build_object(
          'schema_version', 1,
          'response', jsonb_build_object(
            'schema_version', 1,
            'meals', jsonb_build_array(jsonb_build_object('title', 'Tomatenpfanne'))
          ),
          'used_item_snapshots', (
            select recipe_payload -> 'used_item_snapshots'
            from public.chef_recipe_history
            where conversation_id = (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source')
          )
        )
      ))
    ) $$,
    :'household_one'
  ),
  '22023',
  'chef_recipe_snapshot_invalid',
  'ein unvollstaendiger Rezept-Snapshot wird abgelehnt'
);
select is(
  (select count(*)::int from public.chef_conversations where household_id = :'household_one'),
  1,
  'ein unvollstaendiger Snapshot erzeugt keine Conversation'
);
select is(
  (select count(*)::int from public.chef_conversation_turns where household_id = :'household_one'),
  1,
  'ein unvollstaendiger Snapshot erzeugt keinen Turn'
);
select is(
  (select count(*)::int from public.chef_recipe_history where household_id = :'household_one'),
  1,
  'ein unvollstaendiger Snapshot erzeugt keinen Rezept-History-Eintrag'
);

select throws_ok(
  format(
    $$ select public.persist_chef_exchange(
      %L::uuid,
      '81000000-0000-4000-8000-000000000001'::uuid,
      null,
      null,
      '82000000-0000-4000-8000-000000000011'::uuid,
      repeat('b', 64),
      (select request_payload from public.chef_conversation_turns
       where client_request_id = '82000000-0000-4000-8000-000000000001'),
      (select user_text from public.chef_conversation_turns
       where client_request_id = '82000000-0000-4000-8000-000000000001'),
      (select response_payload from public.chef_conversation_turns
       where client_request_id = '82000000-0000-4000-8000-000000000001'),
      jsonb_build_array(jsonb_build_object(
        'title', 'Abweichender Snapshot',
        'recipe_payload', jsonb_build_object(
          'schema_version', 1,
          'response', jsonb_set(
            (select response_payload -> 'result' from public.chef_conversation_turns
             where client_request_id = '82000000-0000-4000-8000-000000000001'),
            '{meals,0,title}',
            to_jsonb('Andere Pfanne'::text)
          ),
          'used_item_snapshots', (
            select recipe_payload -> 'used_item_snapshots'
            from public.chef_recipe_history
            where conversation_id = (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source')
          )
        )
      ))
    ) $$,
    :'household_one'
  ),
  '22023',
  'chef_recipe_snapshot_invalid',
  'ein vom Response-Ergebnis abweichender Snapshot wird abgelehnt'
);
select is(
  (select count(*)::int from public.chef_conversations where household_id = :'household_one'),
  1,
  'ein abweichender Snapshot erzeugt keine Conversation'
);
select is(
  (select count(*)::int from public.chef_conversation_turns where household_id = :'household_one'),
  1,
  'ein abweichender Snapshot erzeugt keinen Turn'
);
select is(
  (select count(*)::int from public.chef_recipe_history where household_id = :'household_one'),
  1,
  'ein abweichender Snapshot erzeugt keinen Rezept-History-Eintrag'
);
reset role;

select tests.authenticate_as('81000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.chef_conversations), 1, 'die Autorin sieht den Verlauf');
select tests.authenticate_as('81000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.chef_conversation_turns), 1, 'ein zweites Mitglied sieht dieselben Turns');
select is((select count(*)::int from public.chef_recipe_history), 1, 'ein zweites Mitglied sieht denselben Rezept-Snapshot');
select tests.authenticate_as('81000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.chef_conversations), 0, 'ein fremder Haushalt sieht keine Conversation');
select is((select count(*)::int from public.chef_recipe_history), 0, 'ein fremder Haushalt sieht keinen Snapshot');
select tests.as_postgres();

select tests.authenticate_as('81000000-0000-4000-8000-000000000001');
select throws_ok(
  format($$ insert into public.chef_conversations (household_id) values (%L::uuid) $$, :'household_one'),
  '42501',
  null,
  'authenticated kann keine Conversation direkt anlegen'
);
select tests.as_postgres();
set local role service_role;
select throws_ok(
  format($$ insert into public.chef_conversations (household_id) values (%L::uuid) $$, :'household_one'),
  '42501',
  null,
  'service_role kann keine Conversation direkt anlegen'
);
reset role;

select throws_ok(
  format(
    $$ insert into public.chef_conversations (household_id, continued_from_id)
       values (%L::uuid, %L::uuid) $$,
    :'household_two',
    (select hydration #>> '{conversation,id}' from chef_test_hydrations where name = 'source')
  ),
  '23503',
  null,
  'ein Parent aus einem anderen Haushalt verletzt den Composite-Fremdschluessel'
);

set local role service_role;
select is(
  (select (public.lookup_chef_exchange(
    :'household_one'::uuid,
    '81000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000001'::uuid,
    repeat('a', 64)
  ) ->> 'status')),
  'match',
  'eine identische Client-Anfrage wird gefunden'
);
select is(
  (select (public.lookup_chef_exchange(
    :'household_one'::uuid,
    '81000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000001'::uuid,
    repeat('b', 64)
  ) ->> 'status')),
  'conflict',
  'dieselbe Client-ID mit anderem Fingerprint wird ohne Inhalt abgelehnt'
);
select is(
  (select (public.lookup_chef_exchange(
    :'household_two'::uuid,
    '81000000-0000-4000-8000-000000000003'::uuid,
    '82000000-0000-4000-8000-000000000001'::uuid,
    repeat('a', 64)
  ) ->> 'status')),
  'conflict',
  'dieselbe Client-ID in einem anderen Haushalt gibt keine History preis'
);
reset role;

set local role service_role;
select is(
  (select error_code from public.preflight_chef_exchange(
    :'household_one'::uuid,
    '81000000-0000-4000-8000-000000000001'::uuid,
    '84000000-0000-4000-8000-000000000001'::uuid,
    null
  )),
  'chef_conversation_not_found',
  'eine unbekannte Conversation-ID liefert einen nicht-informativen 404-Vertrag'
);
select is(
  (select error_code from public.preflight_chef_exchange(
    :'household_two'::uuid,
    '81000000-0000-4000-8000-000000000003'::uuid,
    (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source'),
    null
  )),
  'chef_conversation_not_found',
  'eine fremde Conversation-ID liefert denselben nicht-informativen 404-Vertrag'
);
select is(
  (select error_code from public.preflight_chef_exchange(
    :'household_one'::uuid,
    '81000000-0000-4000-8000-000000000001'::uuid,
    (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source'),
    (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source')
  )),
  'invalid_request',
  'gleichzeitig gesetzte Ziel- und Parent-ID bleiben ein 400-Fehler'
);
reset role;

insert into public.ai_credit_bookings (
  subscriber_user_id,
  household_id,
  request_id,
  action,
  credits
)
values (
  '81000000-0000-4000-8000-000000000001',
  :'household_one'::uuid,
  '82000000-0000-4000-8000-000000000009',
  'recipe',
  3
);
set local role service_role;
select is(
  (select (public.lookup_chef_exchange(
    :'household_one'::uuid,
    '81000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000009'::uuid,
    repeat('f', 64)
  ) ->> 'status')),
  'incomplete',
  'eine Buchung ohne Turn wird vor Context und Provider als unvollstaendig erkannt'
);
select is(
  (select (public.lookup_chef_exchange(
    :'household_two'::uuid,
    '81000000-0000-4000-8000-000000000003'::uuid,
    '82000000-0000-4000-8000-000000000009'::uuid,
    repeat('f', 64)
  ) ->> 'status')),
  'conflict',
  'eine Buchung ohne Turn gibt ihren Zustand keinem anderen Haushalt preis'
);
reset role;
insert into public.ai_credit_refunds (subscriber_user_id, request_id)
values (
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000009'
);
set local role service_role;
select is(
  (select (public.lookup_chef_exchange(
    :'household_one'::uuid,
    '81000000-0000-4000-8000-000000000001'::uuid,
    '82000000-0000-4000-8000-000000000009'::uuid,
    repeat('f', 64)
  ) ->> 'status')),
  'refunded',
  'eine erstattete Client-ID startet keinen zweiten Provideraufruf'
);
reset role;

update public.chef_conversations
set last_activity_at = now() - interval '48 hours'
where id = (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source');
set local role service_role;
select is(
  (select allowed from public.preflight_chef_exchange(
    :'household_one'::uuid,
    '81000000-0000-4000-8000-000000000001'::uuid,
    (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source'),
    null
  )),
  true,
  'genau 48 Stunden sind einschliesslich erlaubt'
);
reset role;

update public.chef_conversations
set last_activity_at = now() - interval '48 hours 1 millisecond'
where id = (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source');
set local role service_role;
select is(
  (select error_code from public.preflight_chef_exchange(
    :'household_one'::uuid,
    '81000000-0000-4000-8000-000000000001'::uuid,
    (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source'),
    null
  )),
  'chef_conversation_continuation_expired',
  'mehr als 48 Stunden werden abgelehnt'
);
reset role;

update public.chef_conversations
set last_activity_at = now() + interval '1 millisecond'
where id = (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source');
set local role service_role;
select is(
  (select error_code from public.preflight_chef_exchange(
    :'household_one'::uuid,
    '81000000-0000-4000-8000-000000000001'::uuid,
    null,
    (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source')
  )),
  'chef_conversation_continuation_expired',
  'ein zukuenftiger Aktivitaetszeitpunkt wird abgelehnt'
);
reset role;

update public.chef_conversations
set last_activity_at = now()
where id = (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source');

set local role service_role;
insert into chef_test_hydrations (name, hydration)
select 'continuation', public.persist_chef_exchange(
  :'household_one'::uuid,
  '81000000-0000-4000-8000-000000000002'::uuid,
  null,
  (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source'),
  '82000000-0000-4000-8000-000000000002'::uuid,
  repeat('c', 64),
  jsonb_build_object(
    'schema_version', 1, 'user_text', 'Und morgen?', 'servings', 2,
    'max_minutes', null, 'dietary_pattern', null, 'shopping_decision', null,
    'selected_inventory_item_ids', '[]'::jsonb
  ),
  'Und morgen?',
  jsonb_build_object(
    'schema_version', 1, 'skill', 'fam-cook-from-inventory', 'model', 'test-model',
    'generated_at', now(), 'priority_food_count', 1,
    'shopping_question', 'Willst du einkaufen?', 'result', null
  ),
  '[]'::jsonb
);
reset role;

select isnt(
  (select hydration #>> '{conversation,id}' from chef_test_hydrations where name = 'continuation'),
  (select hydration #>> '{conversation,id}' from chef_test_hydrations where name = 'source'),
  'eine Fortsetzung erhaelt eine neue Conversation-ID'
);
select is(
  (select hydration #>> '{conversation,continued_from_id}' from chef_test_hydrations where name = 'continuation'),
  (select hydration #>> '{conversation,id}' from chef_test_hydrations where name = 'source'),
  'die neue Conversation verweist auf die unveraenderte Quelle'
);
select is(
  (select count(*)::int from public.chef_conversation_turns
   where conversation_id = (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source')),
  1,
  'die Quelle behaelt ihren einzigen Turn'
);
select is(
  (select count(*)::int from public.chef_recipe_history
   where conversation_id = (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'continuation')),
  0,
  'eine reine Shopping-Frage erzeugt keinen Rezept-Snapshot'
);

set local role service_role;
select is(
  (select error_code from public.preflight_chef_exchange(
    :'household_one'::uuid,
    '81000000-0000-4000-8000-000000000001'::uuid,
    (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'source'),
    null
  )),
  'chef_conversation_source_immutable',
  'eine als Quelle verwendete Conversation nimmt keine normalen Appends mehr an'
);
select is(
  jsonb_array_length(public.get_chef_conversation_context(
    :'household_one'::uuid,
    '81000000-0000-4000-8000-000000000002'::uuid,
    (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'continuation'),
    20,
    32000
  ) -> 'turns'),
  2,
  'der Provider-Kontext enthaelt Ziel und Parent ohne Client-Kontextdaten'
);
reset role;

set local role service_role;
insert into chef_test_hydrations (name, hydration)
select 'bob', public.persist_chef_exchange(
  :'household_one'::uuid,
  '81000000-0000-4000-8000-000000000002'::uuid,
  null,
  null,
  '82000000-0000-4000-8000-000000000003'::uuid,
  repeat('d', 64),
  jsonb_build_object(
    'schema_version', 1, 'user_text', 'Bob fragt', 'servings', 1,
    'max_minutes', null, 'dietary_pattern', null, 'shopping_decision', null,
    'selected_inventory_item_ids', '[]'::jsonb
  ),
  'Bob fragt',
  jsonb_build_object(
    'schema_version', 1, 'skill', 'fam-cook-from-inventory', 'model', 'test-model',
    'generated_at', now(), 'priority_food_count', 0,
    'shopping_question', 'Einkaufen?', 'result', null
  ),
  '[]'::jsonb
);
reset role;

delete from public.profiles where id = '81000000-0000-4000-8000-000000000002';
select is(
  (select created_by from public.chef_conversations
   where id = (select (hydration #>> '{conversation,id}')::uuid from chef_test_hydrations where name = 'bob')),
  null,
  'Account-Loeschung nullt den Conversation-Autor'
);
select is(
  (select created_by from public.chef_conversation_turns
   where client_request_id = '82000000-0000-4000-8000-000000000003'),
  null,
  'Account-Loeschung nullt den Turn-Autor'
);
select is(
  (select count(*)::int from public.chef_conversation_turns
   where client_request_id = '82000000-0000-4000-8000-000000000003'),
  1,
  'Account-Loeschung erhaelt den sichtbaren Turn'
);

set local role service_role;
insert into chef_test_hydrations (name, hydration)
select 'other-household', public.persist_chef_exchange(
  :'household_two'::uuid,
  '81000000-0000-4000-8000-000000000003'::uuid,
  null,
  null,
  '82000000-0000-4000-8000-000000000004'::uuid,
  repeat('e', 64),
  jsonb_build_object(
    'schema_version', 1, 'user_text', 'Andere Frage', 'servings', 1,
    'max_minutes', null, 'dietary_pattern', null, 'shopping_decision', null,
    'selected_inventory_item_ids', '[]'::jsonb
  ),
  'Andere Frage',
  jsonb_build_object(
    'schema_version', 1, 'skill', 'fam-cook-from-inventory', 'model', 'test-model',
    'generated_at', now(), 'priority_food_count', 0,
    'shopping_question', 'Einkaufen?', 'result', null
  ),
  '[]'::jsonb
);
reset role;

delete from public.households where id = :'household_two';
select is((select count(*)::int from public.chef_conversations where household_id = :'household_two'), 0, 'Haushaltsloeschung entfernt Conversations');
select is((select count(*)::int from public.chef_conversation_turns where household_id = :'household_two'), 0, 'Haushaltsloeschung entfernt Turns');
select is((select count(*)::int from public.chef_recipe_history where household_id = :'household_two'), 0, 'Haushaltsloeschung entfernt Rezept-History');

select * from finish();
rollback;
