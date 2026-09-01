-- RevenueCat-Entitlements: serverautorisierte AI-Haushaltszuordnung.

begin;
\ir helpers.sql

select plan(45);

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
    'public.assign_ai_household(uuid,uuid,timestamptz,bigint,text)',
    'execute'
  ),
  'authenticated kann die AI-Zuordnungs-RPC nicht aufrufen'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.assign_ai_household(uuid,uuid,timestamptz,bigint,text)',
    'execute'
  ),
  'anon kann die AI-Zuordnungs-RPC nicht aufrufen'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.assign_ai_household(uuid,uuid,timestamptz,bigint,text)',
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
       where oid = 'public.assign_ai_household(uuid,uuid,timestamptz,bigint,text)'::regprocedure),
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

-- --------------------------------------------- Idempotenz: revenuecat_processed_events
select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.revenuecat_processed_events'::regclass),
  'revenuecat_processed_events hat RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.revenuecat_processed_events', 'select'),
  'authenticated kann verarbeitete Events nicht lesen'
);
select ok(
  not has_table_privilege('authenticated', 'public.revenuecat_processed_events', 'insert'),
  'authenticated kann keine verarbeiteten Events eintragen'
);
select ok(
  not has_table_privilege('anon', 'public.revenuecat_processed_events', 'insert'),
  'anon kann keine verarbeiteten Events eintragen'
);
select ok(
  has_table_privilege('service_role', 'public.revenuecat_processed_events', 'insert'),
  'service_role kann verarbeitete Events eintragen'
);
select ok(
  has_table_privilege('service_role', 'public.revenuecat_processed_events', 'select'),
  'service_role kann verarbeitete Events lesen'
);

set local role service_role;
select lives_ok(
  $$ insert into public.revenuecat_processed_events (event_id, entitlement_id)
     values ('evt_1', 'Plus') $$,
  'ein Event-/Entitlement-Paar kann einmal eingetragen werden'
);
select throws_ok(
  $$ insert into public.revenuecat_processed_events (event_id, entitlement_id)
     values ('evt_1', 'Plus') $$,
  '23505',
  null,
  'dasselbe Event-/Entitlement-Paar kann kein zweites Mal eingetragen werden'
);
select lives_ok(
  $$ insert into public.revenuecat_processed_events (event_id, entitlement_id)
     values ('evt_1', 'AI') $$,
  'dieselbe Event-ID mit einem anderen Entitlement ist ein eigenstaendiger Eintrag'
);
select throws_ok(
  $$ insert into public.revenuecat_processed_events (event_id, entitlement_id)
     values ('evt_2', 'Premium') $$,
  '23514',
  null,
  'nur Plus und AI sind als Entitlement fuer einen verarbeiteten Event-Eintrag zulaessig'
);
reset role;

-- ------------------------------------- Stale-Event-Guard bei assign_ai_household
-- hid_one wurde oben durch alice' Haushaltswechsel bereits deaktiviert und ist
-- frei; carol ist Mitglied und dient hier als unabhaengiger zweiter Subscriber.
set local role service_role;
select lives_ok(
  format(
    $$ select public.assign_ai_household(
         '33333333-3333-3333-3333-333333333333', %L::uuid,
         '2027-01-01T00:00:00Z'::timestamptz, 2000
       ) $$,
    :'hid_one'
  ),
  'Erstzuordnung mit Event-Zeitstempel funktioniert wie ohne'
);
reset role;

select is(
  (select ai_expires_at from public.households where id = :'hid_one'),
  '2027-01-01T00:00:00Z'::timestamptz,
  'der Ablauf aus dem ersten Event ist gesetzt'
);

-- Ein verspaetet zugestelltes aelteres Event (Retry/Out-of-Order) darf den
-- bereits neueren Stand nicht ueberschreiben — auch nicht mit einem
-- abweichenden Ablaufdatum.
set local role service_role;
select lives_ok(
  format(
    $$ select public.assign_ai_household(
         '33333333-3333-3333-3333-333333333333', %L::uuid,
         '2099-01-01T00:00:00Z'::timestamptz, 1000
       ) $$,
    :'hid_one'
  ),
  'ein aelteres Event ist kein Fehler, sondern ein stilles No-op'
);
reset role;

select is(
  (select ai_expires_at from public.households where id = :'hid_one'),
  '2027-01-01T00:00:00Z'::timestamptz,
  'das aeltere Event hat den Ablauf nicht ueberschrieben'
);

-- Ein neueres Event wird ganz normal angewendet.
set local role service_role;
select lives_ok(
  format(
    $$ select public.assign_ai_household(
         '33333333-3333-3333-3333-333333333333', %L::uuid,
         '2027-06-01T00:00:00Z'::timestamptz, 3000
       ) $$,
    :'hid_one'
  ),
  'ein neueres Event wird angewendet'
);
reset role;

select is(
  (select ai_expires_at from public.households where id = :'hid_one'),
  '2027-06-01T00:00:00Z'::timestamptz,
  'das neuere Event hat den Ablauf aktualisiert'
);
select is(
  (select last_event_timestamp_ms
   from public.revenuecat_ai_assignments
   where subscriber_user_id = '33333333-3333-3333-3333-333333333333'),
  3000::bigint,
  'der zuletzt angewendete Event-Zeitstempel ist gespeichert'
);

-- --------------------------------------------------- deactivate_ai_household
-- Eine verspaetete EXPIRATION (aelter als das zuletzt angewendete Event) darf
-- ein bereits neueres Renewal nicht widerrufen.
set local role service_role;
select lives_ok(
  $$ select public.deactivate_ai_household(
       '33333333-3333-3333-3333-333333333333', 2500
     ) $$,
  'eine veraltete EXPIRATION ist ein stilles No-op'
);
reset role;

select ok(
  (select ai_active and ai_subscriber_id = '33333333-3333-3333-3333-333333333333'
   from public.households where id = :'hid_one'),
  'die veraltete EXPIRATION hat den Zugriff nicht widerrufen'
);

set local role service_role;
select lives_ok(
  $$ select public.deactivate_ai_household(
       '33333333-3333-3333-3333-333333333333', 4000
     ) $$,
  'eine aktuelle EXPIRATION deaktiviert AI'
);
reset role;

select ok(
  (select not ai_active and ai_subscriber_id is null and ai_expires_at is null
   from public.households where id = :'hid_one'),
  'die aktuelle EXPIRATION hat den Haushalt deaktiviert'
);

set local role service_role;
select lives_ok(
  $$ select public.deactivate_ai_household(
       '99999999-9999-9999-9999-999999999999', 1
     ) $$,
  'eine EXPIRATION ohne bestehende Zuordnung ist ein stilles No-op'
);
reset role;

select * from finish();
rollback;
