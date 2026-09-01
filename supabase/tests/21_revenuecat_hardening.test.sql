-- Haertung nach Review 2026-09-01: atomare Event-Verarbeitung, kanonische
-- Plus-Zuordnung mit Mehrfachquellen, AI-Zuordnung nach Expiration freigeben,
-- Konto-Loeschung bei aktivem Plus/AI.

begin;
\ir helpers.sql

select plan(23);

select tests.create_user('a1000000-0000-0000-0000-000000000001', 'dave-plus@example.com');
select tests.create_user('a1000000-0000-0000-0000-000000000002', 'erin-plus@example.com');
select tests.create_user('a1000000-0000-0000-0000-000000000003', 'frank-plus@example.com');
select tests.create_user('a1000000-0000-0000-0000-000000000004', 'grace-plus@example.com');
select tests.create_user('a1000000-0000-0000-0000-000000000005', 'dave-ai@example.com');
select tests.create_user('a1000000-0000-0000-0000-000000000006', 'erin-ai@example.com');
select tests.create_user('a1000000-0000-0000-0000-000000000007', 'frank-ai@example.com');
select tests.create_user('a1000000-0000-0000-0000-000000000008', 'grace-ai@example.com');
select tests.create_user('a1000000-0000-0000-0000-000000000009', 'henry-delete@example.com');
select tests.create_user('a100000a-0000-0000-0000-000000000010', 'iris-delete@example.com');

select tests.authenticate_as('a1000000-0000-0000-0000-000000000001');
select public.create_household('Plus Haushalt A') as hh_plus_a \gset
select public.create_household('Plus Haushalt B') as hh_plus_b \gset

select tests.authenticate_as('a1000000-0000-0000-0000-000000000002');
select public.create_household('Plus Multi Haushalt') as hh_multi \gset

select tests.authenticate_as('a1000000-0000-0000-0000-000000000005');
select public.create_household('AI Reassign Haushalt') as hh_ai \gset

select tests.authenticate_as('a1000000-0000-0000-0000-000000000007');
select public.create_household('AI Cooldown Haushalt X') as hh_ai_x \gset
select public.create_household('AI Cooldown Haushalt Y') as hh_ai_y \gset

select tests.authenticate_as('a1000000-0000-0000-0000-000000000009');
select public.create_household('Deletion Haushalt') as hh_delete \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values
  (:'hh_multi', 'a1000000-0000-0000-0000-000000000003', 'member'),
  (:'hh_ai', 'a1000000-0000-0000-0000-000000000006', 'member'),
  (:'hh_delete', 'a100000a-0000-0000-0000-000000000010', 'admin');

-- --------------------------------------------- Plus: kanonische Stickiness
set local role service_role;
select ok(
  (select public.apply_plus_household_event(
    'a1000000-0000-0000-0000-000000000001'::uuid, :'hh_plus_a'::uuid,
    true, '2099-01-01T00:00:00Z'::timestamptz, 1000, 'p-evt-1'
  )),
  'erste Plus-Bindung wird angewendet'
);
select ok(
  (select public.apply_plus_household_event(
    'a1000000-0000-0000-0000-000000000001'::uuid, :'hh_plus_b'::uuid,
    true, '2099-02-01T00:00:00Z'::timestamptz, 2000, 'p-evt-2'
  )),
  'ein Folgeevent mit anderer household_id wird trotzdem angewendet'
);
reset role;

select is(
  (select household_id from public.revenuecat_plus_assignments
   where subscriber_user_id = 'a1000000-0000-0000-0000-000000000001'),
  :'hh_plus_a'::uuid,
  'die Kaufhaushalt-Zuordnung bleibt beim urspruenglichen Haushalt (sticky)'
);
select ok(
  (select not plus_active from public.households where id = :'hh_plus_b'),
  'ein nicht kanonischer Haushalt wird durch das Folgeevent nicht aktiviert'
);

-- Ein wiederholtes Event (gleiche event_id) ist ein No-op, auch mit anderem Payload.
set local role service_role;
select ok(
  not (public.apply_plus_household_event(
    'a1000000-0000-0000-0000-000000000001'::uuid, :'hh_plus_a'::uuid,
    false, null, 500, 'p-evt-1'
  )),
  'ein wiederholter Aufruf mit derselben Event-ID meldet keine Anwendung'
);
reset role;

select ok(
  (select plus_active from public.households where id = :'hh_plus_a'),
  'der wiederholte Aufruf hat den Zustand nicht veraendert'
);

-- ------------------------------------------------- Plus: Mehrfachquellen
set local role service_role;
select public.apply_plus_household_event(
  'a1000000-0000-0000-0000-000000000002'::uuid, :'hh_multi'::uuid,
  true, '2099-01-01T00:00:00Z'::timestamptz, 1000, 'm-evt-1'
);
select public.apply_plus_household_event(
  'a1000000-0000-0000-0000-000000000003'::uuid, :'hh_multi'::uuid,
  true, '2099-01-01T00:00:00Z'::timestamptz, 1000, 'm-evt-2'
);
reset role;

select ok(
  (select plus_active from public.households where id = :'hh_multi'),
  'zwei unabhaengige Plus-Kaeufer aktivieren den gemeinsamen Haushalt'
);

set local role service_role;
select public.apply_plus_household_event(
  'a1000000-0000-0000-0000-000000000002'::uuid, :'hh_multi'::uuid,
  false, null, 2000, 'm-evt-3'
);
reset role;

select ok(
  (select plus_active from public.households where id = :'hh_multi'),
  'die Expiration einer Quelle deaktiviert den Haushalt nicht, solange eine andere aktiv ist'
);

set local role service_role;
select public.apply_plus_household_event(
  'a1000000-0000-0000-0000-000000000003'::uuid, :'hh_multi'::uuid,
  false, null, 2000, 'm-evt-4'
);
reset role;

select ok(
  (select not plus_active from public.households where id = :'hh_multi'),
  'erst wenn alle Quellen inaktiv sind, ist der Haushalt inaktiv'
);

-- ------------------------------------------- Plus: Atomizitaet bei Fehlschlag
set local role service_role;
select throws_ok(
  format(
    $$ select public.apply_plus_household_event(
         'a1000000-0000-0000-0000-000000000004'::uuid, %L::uuid,
         true, '2099-01-01T00:00:00Z'::timestamptz, 1000, 'atomic-evt-1'
       ) $$,
    :'hh_plus_a'
  ),
  '42501',
  'plus_target_household_forbidden',
  'eine erste Bindung an einen fremden Haushalt schlaegt fehl'
);
reset role;

select is(
  (select count(*)::integer from public.revenuecat_processed_events
   where event_id = 'atomic-evt-1' and entitlement_id = 'Plus'),
  0,
  'ein fehlgeschlagener erster Bindungsversuch hinterlaesst keinen Dedup-Eintrag (Atomizitaet)'
);

-- --------------------------------------------- AI: Freigabe nach Expiration
set local role service_role;
select public.assign_ai_household(
  'a1000000-0000-0000-0000-000000000005'::uuid, :'hh_ai'::uuid,
  '2099-01-01T00:00:00Z'::timestamptz, 1000, 'ai-evt-1'
);
select ok(
  (public.deactivate_ai_household(
    'a1000000-0000-0000-0000-000000000005'::uuid, 2000, 'ai-evt-2'
  )),
  'die Expiration deaktiviert die AI-Zuordnung'
);
reset role;

select is(
  (select count(*)::integer from public.revenuecat_ai_assignments
   where household_id = :'hh_ai'::uuid),
  0,
  'die Zuordnung wird nach der Expiration freigegeben'
);

set local role service_role;
select ok(
  (public.assign_ai_household(
    'a1000000-0000-0000-0000-000000000006'::uuid, :'hh_ai'::uuid,
    '2099-02-01T00:00:00Z'::timestamptz, 3000, 'ai-evt-3'
  )),
  'ein anderes Haushaltsmitglied kann AI danach selbst kaufen'
);
reset role;

select is(
  (select ai_subscriber_id from public.households where id = :'hh_ai'),
  'a1000000-0000-0000-0000-000000000006'::uuid,
  'der neue Subscriber ist jetzt der AI-Subscriber des Haushalts'
);

-- --------------------------------------------------- AI: Atomizitaet
set local role service_role;
select public.assign_ai_household(
  'a1000000-0000-0000-0000-000000000007'::uuid, :'hh_ai_x'::uuid,
  '2099-01-01T00:00:00Z'::timestamptz, 1000, 'ai-cooldown-evt-1'
);
reset role;

select throws_ok(
  format(
    $$ select public.assign_ai_household(
         'a1000000-0000-0000-0000-000000000007'::uuid, %L::uuid,
         '2099-02-01T00:00:00Z'::timestamptz, 2000, 'ai-atomic-evt'
       ) $$,
    :'hh_ai_y'
  ),
  'P0001',
  'ai_household_change_cooldown',
  'ein Wechsel innerhalb des Cooldowns schlaegt fehl'
);

select is(
  (select count(*)::integer from public.revenuecat_processed_events
   where event_id = 'ai-atomic-evt' and entitlement_id = 'AI'),
  0,
  'der fehlgeschlagene Wechsel hinterlaesst keinen Dedup-Eintrag (Atomizitaet)'
);

-- ------------------------------------------------- Konto-Loeschung
insert into public.household_members (household_id, user_id, role)
values (:'hh_delete', 'a1000000-0000-0000-0000-000000000009', 'admin')
on conflict do nothing;

set local role service_role;
select public.assign_ai_household(
  'a1000000-0000-0000-0000-000000000009'::uuid, :'hh_delete'::uuid,
  '2099-01-01T00:00:00Z'::timestamptz, 1000, 'delete-ai-evt'
);
select public.apply_plus_household_event(
  'a1000000-0000-0000-0000-000000000009'::uuid, :'hh_delete'::uuid,
  true, '2099-01-01T00:00:00Z'::timestamptz, 1000, 'delete-plus-evt-1'
);
select public.apply_plus_household_event(
  'a100000a-0000-0000-0000-000000000010'::uuid, :'hh_delete'::uuid,
  true, '2099-01-01T00:00:00Z'::timestamptz, 1000, 'delete-plus-evt-2'
);
reset role;

select tests.authenticate_as('a1000000-0000-0000-0000-000000000009');
select lives_ok(
  $$ select public.prepare_account_deletion() $$,
  'prepare_account_deletion scheitert nicht am aktiven AI-/Plus-Status'
);

select tests.as_postgres();
select ok(
  (select not ai_active and ai_subscriber_id is null from public.households where id = :'hh_delete'),
  'AI ist nach der Kontoloeschungs-Vorbereitung deaktiviert'
);
select is(
  (select count(*)::integer from public.revenuecat_ai_assignments
   where subscriber_user_id = 'a1000000-0000-0000-0000-000000000009'),
  0,
  'die AI-Zuordnung des geloeschten Kontos ist entfernt'
);
select is(
  (select count(*)::integer from public.revenuecat_plus_assignments
   where subscriber_user_id = 'a1000000-0000-0000-0000-000000000009'),
  0,
  'die Plus-Zuordnung des geloeschten Kontos ist entfernt'
);
select ok(
  (select plus_active from public.households where id = :'hh_delete'),
  'die zweite Plus-Quelle (iris) haelt den Haushalt weiterhin aktiv'
);

select lives_ok(
  $$ delete from public.profiles where id = 'a1000000-0000-0000-0000-000000000009'::uuid $$,
  'die eigentliche Profil-Loeschung verletzt danach keinen Constraint mehr'
);

select * from finish();
rollback;
