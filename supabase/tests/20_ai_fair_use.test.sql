-- AI-Fair-Use-Vertrag: haushaltsweites Monatskontingent fuer AI-Credits.
-- Der Ledger folgt der kanonischen AI-Zuordnung (Subscriber), nicht dem
-- Haushalt direkt — siehe Kommentar in 03_households.sql.

begin;
\ir helpers.sql

select plan(36);

select tests.create_user('44444444-4444-4444-4444-444444444444', 'alice-credits@example.com');
select tests.create_user('55555555-5555-5555-5555-555555555555', 'bob-credits@example.com');

select tests.authenticate_as('44444444-4444-4444-4444-444444444444');
select public.create_household('Credits Haushalt Eins') as hid_one \gset
select public.create_household('Credits Haushalt Vier') as hid_four \gset

select tests.authenticate_as('55555555-5555-5555-5555-555555555555');
select public.create_household('Credits Haushalt Zwei') as hid_two \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid_four', '44444444-4444-4444-4444-444444444444', 'member')
on conflict do nothing;

set local role service_role;
select public.assign_ai_household(
  '44444444-4444-4444-4444-444444444444', :'hid_one'::uuid, '2099-01-01T00:00:00Z'::timestamptz
);
select public.assign_ai_household(
  '55555555-5555-5555-5555-555555555555', :'hid_two'::uuid, '2099-01-01T00:00:00Z'::timestamptz
);
reset role;

-- -------------------------------------------------------------- RLS und Rechte
select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.ai_credit_bookings'::regclass),
  'ai_credit_bookings hat RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.ai_credit_bookings', 'select'),
  'authenticated kann Credit-Buchungen nicht lesen'
);
select ok(
  not has_table_privilege('authenticated', 'public.ai_credit_bookings', 'insert'),
  'authenticated kann keine Credit-Buchung anlegen'
);
select ok(
  not has_table_privilege('anon', 'public.ai_credit_bookings', 'insert'),
  'anon kann keine Credit-Buchung anlegen'
);
select ok(
  has_table_privilege('service_role', 'public.ai_credit_bookings', 'select'),
  'service_role kann Credit-Buchungen lesen'
);
select ok(
  has_table_privilege('service_role', 'public.ai_credit_bookings', 'insert'),
  'service_role kann Credit-Buchungen anlegen'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.book_ai_credit(uuid,text,uuid,integer)', 'execute'
  ),
  'authenticated kann book_ai_credit nicht aufrufen'
);
select ok(
  not has_function_privilege(
    'anon', 'public.book_ai_credit(uuid,text,uuid,integer)', 'execute'
  ),
  'anon kann book_ai_credit nicht aufrufen'
);
select ok(
  has_function_privilege(
    'service_role', 'public.book_ai_credit(uuid,text,uuid,integer)', 'execute'
  ),
  'service_role kann book_ai_credit aufrufen'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.get_ai_credit_status(uuid,integer)', 'execute'
  ),
  'authenticated kann get_ai_credit_status nicht aufrufen'
);
select ok(
  has_function_privilege(
    'service_role', 'public.get_ai_credit_status(uuid,integer)', 'execute'
  ),
  'service_role kann get_ai_credit_status aufrufen'
);

-- ------------------------------------------------ unzugeordneter Haushalt
set local role service_role;
select throws_ok(
  format(
    $$ select public.book_ai_credit(%L::uuid, 'suggestion', 'a0000000-0000-0000-0000-000000000000'::uuid) $$,
    :'hid_four'
  ),
  '42501',
  'ai_household_not_assigned',
  'ein Haushalt ohne AI-Zuordnung kann noch nicht buchen'
);
reset role;

select is(
  (select credits_used from public.get_ai_credit_status(:'hid_four'::uuid)),
  0,
  'ein Haushalt ohne AI-Zuordnung zeigt 0 Verbrauch statt eines Fehlers'
);

-- -------------------------------------------------------- Gewichtung und Buchung
set local role service_role;
select is(
  (select credits_used
   from public.book_ai_credit(:'hid_one'::uuid, 'suggestion', 'a0000000-0000-0000-0000-000000000001'::uuid)),
  1,
  'eine Vorschlags-Aktion kostet 1 Credit'
);
reset role;

-- Ein wiederholter Aufruf mit derselben Request-ID (Retry) bucht nicht doppelt.
set local role service_role;
select is(
  (select credits_used
   from public.book_ai_credit(:'hid_one'::uuid, 'suggestion', 'a0000000-0000-0000-0000-000000000001'::uuid)),
  1,
  'ein wiederholter Aufruf mit derselben Request-ID ist idempotent'
);
reset role;

select is(
  (select count(*)::integer from public.ai_credit_bookings
   where subscriber_user_id = '44444444-4444-4444-4444-444444444444'),
  1,
  'die idempotente Wiederholung hat keine zweite Zeile angelegt'
);

set local role service_role;
select is(
  (select credits_used
   from public.book_ai_credit(:'hid_one'::uuid, 'recipe', 'a0000000-0000-0000-0000-000000000002'::uuid)),
  4,
  'ein KI-Rezept kostet 3 Credits (kumuliert 1+3)'
);
reset role;

select is(
  (select credits_used from public.get_ai_credit_status(:'hid_one'::uuid)),
  4,
  'get_ai_credit_status liest denselben Stand, ohne selbst zu buchen'
);
select is(
  (select credits_used from public.get_ai_credit_status(:'hid_one'::uuid)),
  4,
  'ein wiederholter Statusaufruf veraendert den Verbrauch nicht'
);

set local role service_role;
select throws_ok(
  format(
    $$ select public.book_ai_credit(%L::uuid, 'unknown', 'a0000000-0000-0000-0000-000000000004'::uuid) $$,
    :'hid_one'
  ),
  '22023',
  'ai_credit_invalid_action',
  'eine unbekannte Aktion wird abgelehnt'
);
reset role;

select is(
  (select credits_used from public.get_ai_credit_status(:'hid_one'::uuid)),
  4,
  'eine abgelehnte Aktion hat keine Credits verbraucht'
);

-- ---------------------------------------------------- 80/100-Prozent-Zustaende
-- Zweiter Subscriber (bob/hid_two) mit kleinem Limit fuer Warn- und Sperrgrenze.
set local role service_role;
select is(
  (select credits_used
   from public.book_ai_credit(
     :'hid_two'::uuid, 'recipe', 'b0000000-0000-0000-0000-000000000001'::uuid, 10
   )),
  3,
  'erste Buchung im kleinen Limit-Szenario (Limit 10)'
);
select is(
  (select credits_used
   from public.book_ai_credit(
     :'hid_two'::uuid, 'recipe', 'b0000000-0000-0000-0000-000000000002'::uuid, 10
   )),
  6,
  'zweite Buchung kumuliert auf 6 von 10'
);
select ok(
  (select not warning_reached
   from public.get_ai_credit_status(:'hid_two'::uuid, 10)),
  'unter 80 Prozent erscheint noch keine Warnung'
);

select is(
  (select credits_used
   from public.book_ai_credit(
     :'hid_two'::uuid, 'voice', 'b0000000-0000-0000-0000-000000000003'::uuid, 10
   )),
  8,
  'dritte Buchung erreicht 8 von 10 (80 Prozent)'
);
select ok(
  (select warning_reached and not blocked
   from public.get_ai_credit_status(:'hid_two'::uuid, 10)),
  'bei 80 Prozent erscheint die Warnung, ohne zu sperren'
);

set local role service_role;
select throws_ok(
  format(
    $$ select public.book_ai_credit(
         %L::uuid, 'recipe', 'b0000000-0000-0000-0000-000000000004'::uuid, 10
       ) $$,
    :'hid_two'
  ),
  'P0001',
  'ai_credit_limit_exceeded',
  'eine Buchung, die das Kontingent ueberschreiten wuerde, wird vollstaendig abgelehnt'
);
reset role;

select is(
  (select credits_used from public.get_ai_credit_status(:'hid_two'::uuid, 10)),
  8,
  'die abgelehnte Ueberschreitung hat keinen Teilverbrauch hinterlassen'
);

set local role service_role;
select is(
  (select credits_used
   from public.book_ai_credit(
     :'hid_two'::uuid, 'suggestion', 'b0000000-0000-0000-0000-000000000005'::uuid, 10
   )),
  9,
  'eine kleinere Aktion passt noch ins verbleibende Kontingent (9 von 10)'
);
select is(
  (select credits_used
   from public.book_ai_credit(
     :'hid_two'::uuid, 'suggestion', 'b0000000-0000-0000-0000-000000000006'::uuid, 10
   )),
  10,
  'das Kontingent laesst sich exakt ausschoepfen (10 von 10)'
);
reset role;

select ok(
  (select blocked from public.get_ai_credit_status(:'hid_two'::uuid, 10)),
  'bei 100 Prozent ist der Zustand gesperrt'
);
select ok(
  (select not plus_active from public.households where id = :'hid_two'),
  'ein ausgeschoepftes AI-Kontingent aendert Plus nicht (Plus war hier ohnehin nie aktiv)'
);

-- ---------------------------------------------------------------- kein Rollover
-- Eine Buchung aus dem Vormonat zaehlt nicht mehr zum laufenden Kontingent.
insert into public.ai_credit_bookings (subscriber_user_id, request_id, action, credits, created_at)
values (
  '44444444-4444-4444-4444-444444444444', 'c0000000-0000-0000-0000-000000000001'::uuid, 'recipe', 3,
  date_trunc('month', now()) - interval '1 day'
);

select is(
  (select credits_used from public.get_ai_credit_status(:'hid_one'::uuid)),
  4,
  'eine Buchung aus dem Vormonat zaehlt nicht zum laufenden Kontingent (kein Rollover)'
);

-- ---------------------------------------- Kontingent folgt der AI-Zuordnung
-- Beim erlaubten monatlichen Haushaltswechsel bleibt der Verbrauch desselben
-- Subscribers erhalten, statt im neuen Haushalt bei 0 zu beginnen.
update public.revenuecat_ai_assignments
set household_changed_at = date_trunc('month', now()) - interval '1 month'
where subscriber_user_id = '44444444-4444-4444-4444-444444444444';

set local role service_role;
select public.assign_ai_household(
  '44444444-4444-4444-4444-444444444444', :'hid_four'::uuid, '2099-01-01T00:00:00Z'::timestamptz
);
reset role;

select is(
  (select credits_used from public.get_ai_credit_status(:'hid_four'::uuid)),
  4,
  'nach dem Haushaltswechsel zeigt der neue Haushalt denselben Verbrauch (kein Reset)'
);
select is(
  (select credits_used from public.get_ai_credit_status(:'hid_one'::uuid)),
  0,
  'der alte Haushalt hat nach dem Wechsel keine AI-Zuordnung mehr und zeigt 0'
);

-- ------------------------------------------------------------------- Isolation
select is(
  (select credits_used from public.get_ai_credit_status(:'hid_two'::uuid, 10)),
  10,
  'der Verbrauch eines anderen Subscribers bleibt unveraendert (Isolation)'
);

select * from finish();
rollback;
