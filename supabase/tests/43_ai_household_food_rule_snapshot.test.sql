-- Der AI-Gateway darf Haushaltsregeln nur ueber einen service-only Snapshot lesen.
begin;
\ir helpers.sql

select plan(21);

select has_function(
  'public',
  'get_ai_household_food_rule_snapshot',
  array['uuid', 'uuid'],
  'der serverseitige Lebensmittelregel-Snapshot ist vorhanden'
);
select ok(
  not (
    select prosecdef
    from pg_proc
    where oid = 'public.get_ai_household_food_rule_snapshot(uuid,uuid)'::regprocedure
  ),
  'der service-only RPC laeuft als SECURITY INVOKER'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_ai_household_food_rule_snapshot(uuid,uuid)',
    'execute'
  ),
  'angemeldete Clients koennen den Snapshot nicht direkt lesen'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_ai_household_food_rule_snapshot(uuid,uuid)',
    'execute'
  ),
  'anonyme Clients koennen den Snapshot nicht lesen'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_ai_household_food_rule_snapshot(uuid,uuid)',
    'execute'
  ),
  'nur die serverseitige Rolle kann den Snapshot lesen'
);

select tests.create_user('11111111-1111-4111-8111-111111111111', 'alice-snapshot@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'bob-snapshot@example.com');
select tests.create_user('33333333-3333-4333-8333-333333333333', 'carol-snapshot@example.com');
select tests.create_user('44444444-4444-4444-8444-444444444444', 'dave-snapshot@example.com');

select tests.authenticate_as('11111111-1111-4111-8111-111111111111');
select public.create_household('Snapshot Haushalt') as hid \gset
select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values
  (:'hid', '22222222-2222-4222-8222-222222222222', 'member'),
  (:'hid', '33333333-3333-4333-8333-333333333333', 'member');
insert into public.profile_food_rules (user_id, allergy_codes, custom_allergies)
values
  ('11111111-1111-4111-8111-111111111111', array['peanuts'], array['Johannisbrot']),
  ('22222222-2222-4222-8222-222222222222', array['milk'], '{}'),
  ('33333333-3333-4333-8333-333333333333', '{}', '{}');

select tests.authenticate_as('22222222-2222-4222-8222-222222222222');
insert into public.child_profiles (household_id, managed_by, display_name, birth_date)
values (:'hid', '22222222-2222-4222-8222-222222222222', 'Mia Snapshot', '2018-04-12')
returning id as child_id \gset
insert into public.child_profile_food_rules (child_profile_id, allergy_codes, disliked_foods)
values (:'child_id', array['eggs'], array['Oliven']);

select tests.authenticate_as('33333333-3333-4333-8333-333333333333');
select is(
  (
    select count(*)::integer
    from public.profile_food_rules
    where user_id in (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    )
  ),
  0,
  'ein Haushaltsmitglied sieht keine privaten Erwachsenenregeln'
);
select is_empty(
  format(
    $$ select child_profile_id from public.child_profile_food_rules
       where child_profile_id = %L::uuid $$,
    :'child_id'
  ),
  'ein nicht verwaltendes Mitglied sieht keine Kinderregeln'
);
select throws_ok(
  format(
    $$ select public.get_ai_household_food_rule_snapshot(
         %L::uuid,
         '33333333-3333-4333-8333-333333333333'::uuid
       ) $$,
    :'hid'
  ),
  '42501',
  'permission denied for function get_ai_household_food_rule_snapshot',
  'ein Client kann die RLS-Grenze nicht ueber den RPC umgehen'
);

set local role service_role;
select public.get_ai_household_food_rule_snapshot(
  :'hid',
  '11111111-1111-4111-8111-111111111111'
) as complete_snapshot \gset
reset role;

select is(
  jsonb_array_length(:'complete_snapshot'::jsonb -> 'adults'),
  3,
  'der Snapshot umfasst alle aktuellen Erwachsenen im Haushalt'
);
select is(
  jsonb_array_length(:'complete_snapshot'::jsonb -> 'children'),
  1,
  'der Snapshot umfasst jedes Kinderprofil im Haushalt'
);
select ok(
  (
    select bool_and(subject -> 'rules' <> 'null'::jsonb)
    from jsonb_array_elements(:'complete_snapshot'::jsonb -> 'adults') subject
  ),
  'jede erwachsene Person hat eine explizite Regelzeile'
);
select ok(
  (:'complete_snapshot'::jsonb -> 'children' -> 0 -> 'rules') <> 'null'::jsonb,
  'das Kinderprofil hat eine explizite Regelzeile'
);
select ok(
  :'complete_snapshot'::text not like '%Snapshot Haushalt%'
    and :'complete_snapshot'::text not like '%Mia Snapshot%'
    and :'complete_snapshot'::text not like '%@example.com%',
  'Anzeigenamen, Haushaltsname und E-Mail-Adressen fehlen im Server-Snapshot'
);

set local role service_role;
select is(
  (
    public.get_ai_household_food_rule_snapshot(
      :'hid',
      '44444444-4444-4444-8444-444444444444'
    ) ->> 'authorized'
  )::boolean,
  false,
  'selbst der Server lehnt einen haushaltsfremden Anfragenden ab'
);

select public.get_ai_household_food_rule_snapshot(
  :'hid',
  '11111111-1111-4111-8111-111111111111'
) as before_rule_change \gset
update public.profile_food_rules
set disliked_foods = array['Pilze']
where user_id = '22222222-2222-4222-8222-222222222222';
select public.get_ai_household_food_rule_snapshot(
  :'hid',
  '11111111-1111-4111-8111-111111111111'
) as after_rule_change \gset
reset role;
select isnt(
  :'before_rule_change'::jsonb,
  :'after_rule_change'::jsonb,
  'eine geaenderte Erwachsenenregel veraendert den Roh-Snapshot'
);

set local role service_role;
delete from public.profile_food_rules
where user_id = '33333333-3333-4333-8333-333333333333';
select public.get_ai_household_food_rule_snapshot(
  :'hid',
  '11111111-1111-4111-8111-111111111111'
) as missing_adult_rules \gset
reset role;
select is(
  (
    select subject -> 'rules'
    from jsonb_array_elements(:'missing_adult_rules'::jsonb -> 'adults') subject
    where subject ->> 'subject_id' = '33333333-3333-4333-8333-333333333333'
  ),
  'null'::jsonb,
  'eine fehlende Erwachsenenregel bleibt als unvollstaendig sichtbar'
);

set local role service_role;
insert into public.profile_food_rules (user_id)
values ('33333333-3333-4333-8333-333333333333');
delete from public.child_profile_food_rules where child_profile_id = :'child_id';
select public.get_ai_household_food_rule_snapshot(
  :'hid',
  '11111111-1111-4111-8111-111111111111'
) as missing_child_rules \gset
reset role;
select is(
  :'missing_child_rules'::jsonb -> 'children' -> 0 -> 'rules',
  'null'::jsonb,
  'eine fehlende Kinderregel bleibt als unvollstaendig sichtbar'
);

set local role service_role;
insert into public.child_profile_food_rules (child_profile_id)
values (:'child_id');
select public.get_ai_household_food_rule_snapshot(
  :'hid',
  '11111111-1111-4111-8111-111111111111'
) as before_member_change \gset
delete from public.household_members
where household_id = :'hid'
  and user_id = '22222222-2222-4222-8222-222222222222';
select public.get_ai_household_food_rule_snapshot(
  :'hid',
  '11111111-1111-4111-8111-111111111111'
) as after_member_change \gset
reset role;

select isnt(
  :'before_member_change'::jsonb,
  :'after_member_change'::jsonb,
  'eine Mitgliedschaftsaenderung veraendert den Roh-Snapshot'
);
select is(
  jsonb_array_length(:'after_member_change'::jsonb -> 'adults'),
  2,
  'ausgetretene Erwachsene gehoeren nicht mehr zum Snapshot'
);
select is(
  (:'after_member_change'::jsonb -> 'children' -> 0 ->> 'manager_authorized')::boolean,
  false,
  'die veraltete Verwalterbeziehung wird nicht als berechtigt behandelt'
);

set local role service_role;
select is(
  (
    public.get_ai_household_food_rule_snapshot(
      :'hid',
      '22222222-2222-4222-8222-222222222222'
    ) ->> 'authorized'
  )::boolean,
  false,
  'ein ausgetretenes Mitglied kann keinen neuen Snapshot ausloesen'
);
reset role;

select tests.as_postgres();
select * from finish();
rollback;
