-- Der Monatsverbrauch folgt dem serverseitigen AI-Subscriber. Jede Request-ID
-- behaelt zusaetzlich ihren Haushaltsscope, damit der interne Replay-Lookup
-- keine Buchungs- oder Erstattungszustaende zwischen Haushalten offenlegt.

begin;
\ir helpers.sql

select plan(59);

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
  (select relrowsecurity
   from pg_class
   where oid = 'public.ai_credit_refunds'::regclass),
  'ai_credit_refunds hat RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.ai_credit_refunds', 'select'),
  'authenticated kann Credit-Erstattungen nicht lesen'
);
select ok(
  has_table_privilege('service_role', 'public.ai_credit_refunds', 'select') and
    has_table_privilege('service_role', 'public.ai_credit_refunds', 'insert'),
  'service_role kann Erstattungen lesen und anlegen'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.book_ai_credit(uuid,text,uuid,integer,uuid)', 'execute'
  ),
  'authenticated kann book_ai_credit nicht aufrufen'
);
select ok(
  not has_function_privilege(
    'anon', 'public.book_ai_credit(uuid,text,uuid,integer,uuid)', 'execute'
  ),
  'anon kann book_ai_credit nicht aufrufen'
);
select ok(
  has_function_privilege(
    'service_role', 'public.book_ai_credit(uuid,text,uuid,integer,uuid)', 'execute'
  ),
  'service_role kann book_ai_credit aufrufen'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.refund_ai_credit(uuid,uuid)', 'execute'
  ),
  'authenticated kann refund_ai_credit nicht aufrufen'
);
select ok(
  has_function_privilege(
    'service_role', 'public.refund_ai_credit(uuid,uuid)', 'execute'
  ),
  'service_role kann refund_ai_credit aufrufen'
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
select ok(
  (select credits_used = 1 and booking_created
   from public.book_ai_credit(:'hid_one'::uuid, 'suggestion', 'a0000000-0000-0000-0000-000000000001'::uuid)),
  'eine neue Vorschlags-Aktion kostet 1 Credit und wird als neue Buchung markiert'
);
reset role;

select is(
  (select household_id
   from public.ai_credit_bookings
   where request_id = 'a0000000-0000-0000-0000-000000000001'::uuid),
  :'hid_one'::uuid,
  'eine neue Credit-Buchung speichert den zugehoerigen Haushalt'
);

-- Ein wiederholter Aufruf mit derselben Request-ID (Retry) bucht nicht doppelt.
set local role service_role;
select ok(
  (select credits_used = 1 and not booking_created
   from public.book_ai_credit(:'hid_one'::uuid, 'suggestion', 'a0000000-0000-0000-0000-000000000001'::uuid)),
  'ein wiederholter Aufruf bucht nicht doppelt und wird als bestehend markiert'
);
reset role;

set local role service_role;
select throws_ok(
  format(
    $$ select public.book_ai_credit(
         %L::uuid, 'recipe', 'a0000000-0000-0000-0000-000000000001'::uuid
       ) $$,
    :'hid_one'
  ),
  '22023',
  'ai_credit_request_mismatch',
  'dieselbe Request-ID darf nicht fuer eine andere Aktion wiederverwendet werden'
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

select credits_used as credits_before_refund
from public.get_ai_credit_status(:'hid_one'::uuid) \gset
set local role service_role;
select is(
  (select credits_used
   from public.book_ai_credit(
     :'hid_one'::uuid,
     'recipe',
     'a0000000-0000-0000-0000-000000000010'::uuid
   )),
  :'credits_before_refund'::integer + 3,
  'eine Erstattungsprobe bucht zuerst drei Rezept-Credits'
);
select is(
  public.refund_ai_credit(
    '44444444-4444-4444-4444-444444444444'::uuid,
    'a0000000-0000-0000-0000-000000000010'::uuid
  ),
  true,
  'die erste Erstattung wird append-only gebucht'
);
reset role;
select is(
  (select credits_used from public.get_ai_credit_status(:'hid_one'::uuid)),
  :'credits_before_refund'::integer,
  'erstattete Credits werden aus dem Monatsverbrauch herausgerechnet'
);
set local role service_role;
select is(
  public.refund_ai_credit(
    '44444444-4444-4444-4444-444444444444'::uuid,
    'a0000000-0000-0000-0000-000000000010'::uuid
  ),
  false,
  'eine wiederholte Erstattung legt keine zweite Erstattung an'
);
select throws_ok(
  format(
    $$ select public.book_ai_credit(
         %L::uuid, 'recipe', 'a0000000-0000-0000-0000-000000000010'::uuid
       ) $$,
    :'hid_one'
  ),
  '22023',
  'ai_credit_request_refunded',
  'derselbe erstattete Request wird nicht kostenfrei erneut ausgefuehrt'
);
reset role;

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

set local role service_role;
select throws_ok(
  format(
    $$ select public.book_ai_credit(
         %L::uuid,
         'suggestion',
         'a0000000-0000-0000-0000-000000000011'::uuid,
         100,
         '55555555-5555-5555-5555-555555555555'::uuid
       ) $$,
    :'hid_one'
  ),
  '40001',
  'ai_subscriber_changed',
  'eine Buchung fuer einen inzwischen anderen AI-Subscriber wird abgelehnt'
);
reset role;
select is(
  (select credits_used from public.get_ai_credit_status(:'hid_one'::uuid)),
  4,
  'der Subscriber-Konflikt hat keine Credits verbraucht'
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

-- ----------------------------------------------------- parallele Buchungen
-- Zwei getrennte DB-Sitzungen starten an der Monatsgrenze bei 99/100 Credits.
-- Genau eine Buchung darf committen; die zweite muss nach dem Subscriber-Lock
-- die bereits erfolgte erste Buchung sehen und abgewiesen werden.
create extension if not exists dblink with schema extensions;

create or replace function tests.wait_for_session_wait_event(
  p_application_name text,
  p_wait_event text
)
returns boolean
language plpgsql
as $$
declare
  v_deadline timestamptz := pg_catalog.clock_timestamp() + interval '2 seconds';
begin
  loop
    if exists (
      select 1
      from pg_catalog.pg_stat_activity as activity
      where activity.application_name = p_application_name
        and activity.wait_event = p_wait_event
    ) then
      return true;
    end if;

    exit when pg_catalog.clock_timestamp() >= v_deadline;
    perform pg_catalog.pg_sleep(0.02);
  end loop;

  return false;
end;
$$;

select extensions.dblink_connect(
  'ai_credit_first',
  pg_catalog.format(
    'host=supabase_db_fam port=5432 dbname=%s user=postgres password=postgres connect_timeout=3 application_name=ai_credit_first',
    pg_catalog.current_database()
  )
);
select extensions.dblink_connect(
  'ai_credit_second',
  pg_catalog.format(
    'host=supabase_db_fam port=5432 dbname=%s user=postgres password=postgres connect_timeout=3 application_name=ai_credit_second',
    pg_catalog.current_database()
  )
);

select ok(
  not exists (
    select 1
    from auth.users
    where id = '95000000-0000-4000-8000-000000000001'
  ) and not exists (
    select 1
    from public.households
    where id = '95000000-0000-4000-8000-000000000002'
  ),
  'die festen Paralleltest-Fixtures sind vor dem Lauf unbenutzt'
);

select extensions.dblink_exec(
  'ai_credit_first',
  $setup$
    do $block$
    begin
      if exists (
        select 1
        from auth.users
        where id = '95000000-0000-4000-8000-000000000001'
      ) or exists (
        select 1
        from public.households
        where id = '95000000-0000-4000-8000-000000000002'
      ) then
        raise exception 'ai_credit_concurrency_fixtures_already_exist';
      end if;
    end;
    $block$;
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
    ) values (
      '95000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'ai-credit-concurrency@example.invalid',
      'not-used', now(), now()
    );
    insert into public.households (id, name, created_by)
    values (
      '95000000-0000-4000-8000-000000000002',
      'AI Credit Paralleltest',
      '95000000-0000-4000-8000-000000000001'
    );
    insert into public.household_members (household_id, user_id, role)
    values (
      '95000000-0000-4000-8000-000000000002',
      '95000000-0000-4000-8000-000000000001',
      'admin'
    );
    insert into public.revenuecat_ai_assignments (
      subscriber_user_id, household_id, active
    ) values (
      '95000000-0000-4000-8000-000000000001',
      '95000000-0000-4000-8000-000000000002',
      true
    );
    insert into public.ai_credit_bookings (
      subscriber_user_id, request_id, action, credits
    )
    select
      '95000000-0000-4000-8000-000000000001',
      ('95000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
      'suggestion',
      1
    from pg_catalog.generate_series(1, 99) as series;
  $setup$
);

select extensions.dblink_exec('ai_credit_first', 'begin');
select extensions.dblink_exec(
  'ai_credit_first',
  $first_setup$
    create function pg_temp.ai_credit_book_and_hold()
    returns integer
    language plpgsql
    as $function$
    declare
      v_credits_used integer;
    begin
      select credits_used
      into strict v_credits_used
      from public.book_ai_credit(
        '95000000-0000-4000-8000-000000000002',
        'suggestion',
        '95000000-0000-4000-8001-000000000001',
        100
      );
      perform pg_catalog.pg_sleep(3);
      return v_credits_used;
    end;
    $function$;
    set local role service_role;
  $first_setup$
);
select extensions.dblink_send_query(
  'ai_credit_first',
  'select pg_temp.ai_credit_book_and_hold()'
);
select ok(
  tests.wait_for_session_wait_event('ai_credit_first', 'PgSleep'),
  'die erste Buchung ist erfolgt und haelt ihre Transaktion offen'
);

select extensions.dblink_exec('ai_credit_second', 'begin');
select extensions.dblink_exec('ai_credit_second', 'set local role service_role');
select extensions.dblink_send_query(
  'ai_credit_second',
  $second_query$
    select credits_used
    from public.book_ai_credit(
      '95000000-0000-4000-8000-000000000002',
      'suggestion',
      '95000000-0000-4000-8001-000000000002',
      100
    )
  $second_query$
);
select pg_catalog.pg_sleep(0.1);
select is(
  extensions.dblink_is_busy('ai_credit_second'),
  1,
  'die zweite Buchung wartet auf den ersten Subscriber-Lock'
);
create temporary table ai_credit_first_result (
  credits_used integer
) on commit drop;
insert into ai_credit_first_result
select *
from extensions.dblink_get_result('ai_credit_first')
  as result(credits_used integer);
select count(*)
from extensions.dblink_get_result('ai_credit_first')
  as result(credits_used integer);
select is(
  (select count(*) from ai_credit_first_result),
  1::bigint,
  'die erste parallele Buchung liefert ein Ergebnis'
);
select is(
  (select max(credits_used) from ai_credit_first_result),
  100,
  'die erste Buchung darf das Limit exakt erreichen'
);
select extensions.dblink_exec('ai_credit_first', 'commit');
select is(
  (
    select count(*)
    from extensions.dblink_get_result('ai_credit_second', false)
      as result(credits_used integer)
  ),
  0::bigint,
  'die konkurrierende Ueberschreitung liefert kein Buchungsergebnis'
);
select ok(
  extensions.dblink_error_message('ai_credit_second')
    like '%ai_credit_limit_exceeded%',
  'die zweite Buchung erkennt das verbrauchte Monatslimit'
);
select count(*)
from extensions.dblink_get_result('ai_credit_second', false)
  as result(credits_used integer);
select extensions.dblink_exec('ai_credit_second', 'commit');
select is(
  (
    select count(*)
    from public.ai_credit_bookings
    where subscriber_user_id = '95000000-0000-4000-8000-000000000001'
      and created_at >= (date_trunc('month', (now() at time zone 'UTC')) at time zone 'UTC')
  ),
  100::bigint,
  'beide parallelen Buchungen koennen zusammen das Monatslimit nicht ueberschreiten'
);

select extensions.dblink_exec(
  'ai_credit_first',
  $cleanup$
    delete from public.households
    where id = '95000000-0000-4000-8000-000000000002';
    delete from auth.users
    where id = '95000000-0000-4000-8000-000000000001';
  $cleanup$
);
select is(
  pg_catalog.jsonb_build_object(
    'users', (
      select count(*)
      from auth.users
      where id = '95000000-0000-4000-8000-000000000001'
    ),
    'households', (
      select count(*)
      from public.households
      where id = '95000000-0000-4000-8000-000000000002'
    ),
    'bookings', (
      select count(*)
      from public.ai_credit_bookings
      where subscriber_user_id = '95000000-0000-4000-8000-000000000001'
    )
  ),
  '{"users": 0, "households": 0, "bookings": 0}'::jsonb,
  'parallele AI-Credit-Fixtures werden vollstaendig entfernt'
);
select extensions.dblink_disconnect('ai_credit_second');
select extensions.dblink_disconnect('ai_credit_first');

select * from finish();
rollback;
