-- meal_plans, meal_plan_entries (#128).

begin;
\ir helpers.sql

select plan(10);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'member');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

insert into public.recipes (household_id, title, created_by)
values (:'hid', 'Spaghetti Bolognese', '11111111-1111-1111-1111-111111111111')
returning id as recipe_id \gset

insert into public.meal_plans (household_id, name, week_start_date, created_by)
values (:'hid', 'Woche 34', '2026-08-17', '11111111-1111-1111-1111-111111111111')
returning id as plan_id \gset

insert into public.meal_plan_entries
  (meal_plan_id, household_id, recipe_id, entry_date, meal_slot, servings_mode, portions)
values
  (:'plan_id', :'hid', :'recipe_id', '2026-08-17', 'dinner', 'portions', 4)
returning id as entry_id \gset

-- ------------------------------------------------------- geteilt im Haushalt
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.meal_plans),
  1,
  'ein anderes Haushaltsmitglied sieht den Wochenplan'
);

select is(
  (select count(*)::int from public.meal_plan_entries where meal_plan_id = :'plan_id'),
  1,
  'ein anderes Haushaltsmitglied sieht den Wochenplan-Eintrag'
);

insert into public.meal_plan_entries
  (meal_plan_id, household_id, recipe_id, entry_date, meal_slot, servings_mode, portions, people_count)
values
  (:'plan_id', :'hid', :'recipe_id', '2026-08-18', 'lunch', 'people', 5, 4);

select is(
  (select count(*)::int from public.meal_plan_entries where meal_plan_id = :'plan_id'),
  2,
  'jedes Mitglied darf Eintraege zu einem geteilten Wochenplan hinzufuegen'
);

-- ------------------------------------------------------------- Aussenstehende
select tests.authenticate_as('33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.meal_plans),
  0,
  'Aussenstehende sehen fremde Wochenplaene nicht'
);

select is(
  (select count(*)::int from public.meal_plan_entries),
  0,
  'Aussenstehende sehen fremde Wochenplan-Eintraege nicht'
);

select throws_ok(
  format(
    $$ insert into public.meal_plans (household_id, name, week_start_date, created_by)
       values (%L, 'eingeschleust', '2026-08-17', '33333333-3333-3333-3333-333333333333') $$,
    :'hid'
  ),
  '42501',
  'new row violates row-level security policy for table "meal_plans"',
  'Aussenstehende koennen keinen Wochenplan in einen fremden Haushalt einschleusen'
);

select throws_ok(
  format(
    $$ insert into public.meal_plan_entries
         (meal_plan_id, household_id, recipe_id, entry_date, meal_slot, servings_mode, portions)
       values (%L, %L, %L, '2026-08-19', 'snack', 'portions', 2) $$,
    :'plan_id', :'hid', :'recipe_id'
  ),
  '42501',
  'new row violates row-level security policy for table "meal_plan_entries"',
  'Aussenstehende koennen keinen Eintrag in einen fremden Wochenplan einschleusen'
);

-- --------------------------------------------------------- Check-Constraints
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select throws_ok(
  format(
    $$ insert into public.meal_plan_entries
         (meal_plan_id, household_id, recipe_id, entry_date, meal_slot, servings_mode, portions, people_count)
       values (%L, %L, %L, '2026-08-19', 'snack', 'portions', 2, 3) $$,
    :'plan_id', :'hid', :'recipe_id'
  ),
  '23514',
  null,
  'im Portionen-Modus darf people_count nicht gesetzt sein'
);

select throws_ok(
  format(
    $$ insert into public.meal_plan_entries
         (meal_plan_id, household_id, recipe_id, entry_date, meal_slot, servings_mode, portions)
       values (%L, %L, %L, '2026-08-19', 'snack', 'people', 2) $$,
    :'plan_id', :'hid', :'recipe_id'
  ),
  '23514',
  null,
  'im Personen-Modus muss people_count gesetzt sein'
);

-- Zweiter Plan fuer dieselbe Woche desselben Haushalts ist nicht erlaubt.
select throws_ok(
  format(
    $$ insert into public.meal_plans (household_id, name, week_start_date, created_by)
       values (%L, 'Zweiter Plan', '2026-08-17', '11111111-1111-1111-1111-111111111111') $$,
    :'hid'
  ),
  '23505',
  null,
  'pro Haushalt und Kalenderwoche ist nur ein Wochenplan erlaubt'
);

select * from finish();
rollback;
