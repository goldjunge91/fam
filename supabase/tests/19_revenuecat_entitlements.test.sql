-- RevenueCat-Entitlements: serverautorisierte AI-Haushaltszuordnung.

begin;
\ir helpers.sql

select plan(23);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice-ai@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob-ai@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol-ai@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('AI Haushalt Eins') as hid_one \gset
select public.create_household('AI Haushalt Zwei') as hid_two \gset

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select public.create_household('Fremder AI Haushalt') as hid_foreign \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values
  (:'hid_one', '33333333-3333-3333-3333-333333333333', 'member'),
  (:'hid_two', '33333333-3333-3333-3333-333333333333', 'member');

-- -------------------------------------------------------------- RLS und Rechte
select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.revenuecat_ai_assignments'::regclass),
  'revenuecat_ai_assignments hat RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.revenuecat_ai_assignments', 'select'),
  'authenticated kann AI-Zuordnungen nicht lesen'
);
select ok(
  not has_table_privilege('authenticated', 'public.revenuecat_ai_assignments', 'insert'),
  'authenticated kann AI-Zuordnungen nicht anlegen'
);
select ok(
  not has_table_privilege('authenticated', 'public.revenuecat_ai_assignments', 'update'),
  'authenticated kann AI-Zuordnungen nicht aendern'
);
select ok(
  not has_table_privilege('authenticated', 'public.revenuecat_ai_assignments', 'delete'),
  'authenticated kann AI-Zuordnungen nicht loeschen'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.assign_ai_household(uuid,uuid,timestamptz)',
    'execute'
  ),
  'authenticated kann die AI-Zuordnungs-RPC nicht aufrufen'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.assign_ai_household(uuid,uuid,timestamptz)',
    'execute'
  ),
  'anon kann die AI-Zuordnungs-RPC nicht aufrufen'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.assign_ai_household(uuid,uuid,timestamptz)',
    'execute'
  ),
  'service_role kann die AI-Zuordnungs-RPC aufrufen'
);
select ok(
  has_table_privilege('service_role', 'public.revenuecat_ai_assignments', 'select'),
  'service_role kann AI-Zuordnungen lesen'
);
select ok(
  not (select prosecdef
       from pg_proc
       where oid = 'public.assign_ai_household(uuid,uuid,timestamptz)'::regprocedure),
  'die service-role-only RPC laeuft als SECURITY INVOKER'
);

-- ------------------------------------------------------ Ziel muss Mitglied sein
select throws_ok(
  format(
    $$ select public.assign_ai_household(
         '11111111-1111-1111-1111-111111111111', %L::uuid,
         '2026-10-15T00:00:00Z'::timestamptz
       ) $$,
    :'hid_foreign'
  ),
  '42501',
  'ai_target_household_forbidden',
  'ein Subscriber kann AI keinem fremden Haushalt zuordnen'
);

-- --------------------------------------------------------- erste AI-Zuordnung
set local role service_role;
select lives_ok(
  format(
    $$ select public.assign_ai_household(
         '11111111-1111-1111-1111-111111111111', %L::uuid,
         '2026-10-15T00:00:00Z'::timestamptz
       ) $$,
    :'hid_one'
  ),
  'service_role kann die erste AI-Zuordnung atomar anlegen'
);
reset role;

select is(
  (select household_id
   from public.revenuecat_ai_assignments
   where subscriber_user_id = '11111111-1111-1111-1111-111111111111'),
  :'hid_one'::uuid,
  'die kanonische Zuordnung zeigt auf den ersten Haushalt'
);
select ok(
  (select ai_active
     and ai_subscriber_id = '11111111-1111-1111-1111-111111111111'
     and ai_expires_at = '2026-10-15T00:00:00Z'::timestamptz
   from public.households where id = :'hid_one'),
  'die Haushaltsprojektion enthaelt Status, Subscriber und Ablauf'
);

-- Derselbe Zielhaushalt ist ein idempotentes Refresh, kein Wechsel.
set local role service_role;
select lives_ok(
  format(
    $$ select public.assign_ai_household(
         '11111111-1111-1111-1111-111111111111', %L::uuid,
         '2026-11-15T00:00:00Z'::timestamptz
       ) $$,
    :'hid_one'
  ),
  'dieselbe Zuordnung kann idempotent aktualisiert werden'
);
reset role;

select is(
  (select ai_expires_at from public.households where id = :'hid_one'),
  '2026-11-15T00:00:00Z'::timestamptz,
  'ein idempotentes Refresh aktualisiert das Ablaufdatum'
);

-- ---------------------------------------------------------- Monatswechsel-Limit
set local role service_role;
select throws_ok(
  format(
    $$ select public.assign_ai_household(
         '11111111-1111-1111-1111-111111111111', %L::uuid,
         '2026-11-15T00:00:00Z'::timestamptz
       ) $$,
    :'hid_two'
  ),
  'P0001',
  'ai_household_change_cooldown',
  'ein zweiter Zielhaushalt im selben UTC-Kalendermonat ist gesperrt'
);
reset role;

update public.revenuecat_ai_assignments
set household_changed_at = date_trunc('month', now()) - interval '1 month'
where subscriber_user_id = '11111111-1111-1111-1111-111111111111';

set local role service_role;
select lives_ok(
  format(
    $$ select public.assign_ai_household(
         '11111111-1111-1111-1111-111111111111', %L::uuid,
         '2026-12-15T00:00:00Z'::timestamptz
       ) $$,
    :'hid_two'
  ),
  'im naechsten UTC-Kalendermonat ist genau ein Wechsel erlaubt'
);
reset role;

select ok(
  (select not ai_active and ai_subscriber_id is null and ai_expires_at is null
   from public.households where id = :'hid_one'),
  'der alte Haushalt wird beim Wechsel deaktiviert'
);
select ok(
  (select ai_active
     and ai_subscriber_id = '11111111-1111-1111-1111-111111111111'
     and ai_expires_at = '2026-12-15T00:00:00Z'::timestamptz
   from public.households where id = :'hid_two'),
  'der neue Haushalt wird beim Wechsel aktiviert'
);
select is(
  (select household_id
   from public.revenuecat_ai_assignments
   where subscriber_user_id = '11111111-1111-1111-1111-111111111111'),
  :'hid_two'::uuid,
  'die kanonische Zuordnung wechselt zusammen mit der Projektion'
);

-- Ein Haushalt kann nicht zwei aktive AI-Subscriber-Zuordnungen tragen.
set local role service_role;
select throws_ok(
  format(
    $$ select public.assign_ai_household(
         '33333333-3333-3333-3333-333333333333', %L::uuid,
         '2026-12-15T00:00:00Z'::timestamptz
       ) $$,
    :'hid_two'
  ),
  '23505',
  null,
  'ein zweiter AI-Subscriber fuer denselben Haushalt wird abgelehnt'
);
reset role;

select throws_ok(
  format(
    $$ update public.households
       set ai_active = true, ai_subscriber_id = null
       where id = %L::uuid $$,
    :'hid_one'
  ),
  '23514',
  null,
  'ein aktiver AI-Haushalt braucht immer einen Subscriber'
);

select * from finish();
rollback;
