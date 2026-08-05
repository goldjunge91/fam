-- Die Datenschutz-Kernzusage des Projekts (#41, #43).
--
-- Das README verspricht: Kalorien, Gewicht und Ziele bleiben pro Account privat
-- und werden nicht mit dem Haushalt geteilt. Diese Datei ist der Nachweis.
--
-- Der Aufbau ist bewusst der unguenstigste Fall: Alice und Bob sind im SELBEN
-- Haushalt, Bob ist sogar Administrator. Wenn die Trennung irgendwo leckt, dann
-- hier.

begin;
\ir helpers.sql

select plan(12);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

-- Bob ist Administrator — die maechtigste Rolle im Haushalt.
select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'admin');

-- Alice traegt private Daten ein.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

insert into public.food_entries (user_id, logged_on, meal_type, quantity, unit, name, kcal)
values ('11111111-1111-1111-1111-111111111111', current_date, 'breakfast', 80, 'g', 'Haferflocken', 298);

insert into public.weight_entries (user_id, measured_on, weight_kg, waist_cm)
values ('11111111-1111-1111-1111-111111111111', current_date, 71.4, 82);

insert into public.user_goals (user_id, goal_type, target_weight_kg, rate_kg_per_week, daily_kcal)
values ('11111111-1111-1111-1111-111111111111', 'lose', 68, 0.5, 2100);

select is(
  (select count(*)::int from public.food_entries),
  1,
  'Alice sieht ihren eigenen Tagebucheintrag'
);
select is(
  (select count(*)::int from public.weight_entries),
  1,
  'Alice sieht ihre eigene Gewichtsmessung'
);
select is(
  (select count(*)::int from public.user_goals),
  1,
  'Alice sieht ihr eigenes Ziel'
);

-- ============================================================================
-- Der eigentliche Test: Bob ist Administrator DESSELBEN Haushalts.
-- ============================================================================
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select ok(
  (select private.is_household_admin(:'hid')),
  'Vorbedingung: Bob ist tatsaechlich Administrator dieses Haushalts'
);

select is(
  (select count(*)::int from public.food_entries),
  0,
  'ein Haushalts-Administrator sieht fremde Tagebucheintraege NICHT'
);

select is(
  (select count(*)::int from public.weight_entries),
  0,
  'ein Haushalts-Administrator sieht fremde Gewichtsdaten NICHT'
);

select is(
  (select count(*)::int from public.user_goals),
  0,
  'ein Haushalts-Administrator sieht fremde Ziele NICHT'
);

-- Schreibversuche muessen ebenso ins Leere laufen.
update public.food_entries set kcal = 1 where user_id = '11111111-1111-1111-1111-111111111111';
update public.weight_entries set weight_kg = 99 where user_id = '11111111-1111-1111-1111-111111111111';
delete from public.user_goals where user_id = '11111111-1111-1111-1111-111111111111';

select tests.as_postgres();

select is(
  (select kcal from public.food_entries),
  298::numeric(8,2),
  'der Administrator konnte den fremden Tagebucheintrag nicht veraendern'
);
select is(
  (select weight_kg from public.weight_entries),
  71.4::numeric(5,2),
  'der Administrator konnte die fremde Gewichtsmessung nicht veraendern'
);
select is(
  (select count(*)::int from public.user_goals),
  1,
  'der Administrator konnte das fremde Ziel nicht loeschen'
);

-- Bob kann auch keine Eintraege in Alices Namen anlegen.
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ insert into public.weight_entries (user_id, weight_kg)
     values ('11111111-1111-1111-1111-111111111111', 55) $$,
  '42501',
  'new row violates row-level security policy for table "weight_entries"',
  'niemand kann Messwerte im Namen eines anderen anlegen'
);

-- ------------------------------------------------------------------- anonym
select tests.authenticate_as_anon();

select is(
  (select count(*)::int from public.food_entries)
    + (select count(*)::int from public.weight_entries)
    + (select count(*)::int from public.user_goals),
  0,
  'ein anonymer Client sieht keinerlei Tracking-Daten'
);

select tests.as_postgres();
select * from finish();
rollback;
