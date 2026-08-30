-- Injektionsplaene (#305): expliziter Rhythmus und strikte Privatheit.

begin;
\ir helpers.sql

select plan(6);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'admin');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.injection_plans (
  user_id,
  medication_name,
  dose,
  unit,
  cadence_days,
  anchor_at,
  reminder_enabled
)
values (
  '11111111-1111-1111-1111-111111111111',
  'Semaglutid',
  0.5,
  'mg',
  7,
  '2026-08-31 08:00:00+00',
  true
);

select is(
  (select count(*)::int from public.injection_plans),
  1,
  'Alice sieht ihren Injektionsplan'
);

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.injection_plans),
  0,
  'Haushalts-Admin Bob sieht Alices Injektionsplan nicht'
);

select tests.as_postgres();
select throws_ok(
  $$ insert into public.injection_plans
       (user_id, medication_name, dose, unit, cadence_days, anchor_at)
     values
       ('11111111-1111-1111-1111-111111111111', 'Semaglutid', 0.5, 'drops', 7, now()) $$,
  '23514',
  null,
  'eine unbekannte Einheit wird abgelehnt'
);

select throws_ok(
  $$ insert into public.injection_plans
       (user_id, medication_name, dose, unit, cadence_days, anchor_at)
     values
       ('11111111-1111-1111-1111-111111111111', 'Semaglutid', 0.5, 'mg', 0, now()) $$,
  '23514',
  null,
  'eine nicht positive Kadenz wird abgelehnt'
);

select hasnt_column(
  'public',
  'injection_plans',
  'child_profile_id',
  'Injektionsplaene bauen waehrend des Tracking-Frosts keinen Kind-Bezug vor'
);

select ok(
  not has_table_privilege('authenticated', 'public.injection_plans', 'truncate')
  and not has_table_privilege('authenticated', 'public.injection_plans', 'references')
  and not has_table_privilege('authenticated', 'public.injection_plans', 'trigger'),
  'App-Clients erhalten keine strukturellen Tabellenrechte'
);

select * from finish();
rollback;
