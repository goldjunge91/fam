-- meal_plans, meal_plan_entries (#128).

begin;
\ir helpers.sql

select plan(15);

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

insert into public.meal_plan_entries
  (meal_plan_id, household_id, recipe_id, custom_title, custom_ingredients,
   entry_date, meal_slot, servings_mode, portions)
values
  (:'plan_id', :'hid', null, 'Gemüsepfanne',
   '[{"name":"Paprika","quantity":2,"unit":"piece"}]'::jsonb,
   '2026-08-18', 'lunch', 'portions', 2)
returning id as custom_entry_id \gset

select is(
  (select custom_title from public.meal_plan_entries where id = :'custom_entry_id'),
  'Gemüsepfanne',
  'ein Freitextgericht speichert seinen Namen'
);

select is(
  (select custom_ingredients -> 0 ->> 'name'
   from public.meal_plan_entries where id = :'custom_entry_id'),
  'Paprika',
  'ein Freitextgericht speichert seine Zutaten'
);

-- ------------------------------------------------------- geteilt im Haushalt
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.meal_plans),
  1,
  'ein anderes Haushaltsmitglied sieht den Wochenplan'
);

select is(
  (select count(*)::int from public.meal_plan_entries where meal_plan_id = :'plan_id'),
  2,
  'ein anderes Haushaltsmitglied sieht Rezept- und Freitext-Eintraege'
);

insert into public.meal_plan_entries
  (meal_plan_id, household_id, recipe_id, entry_date, meal_slot, servings_mode, portions, people_count)
values
  (:'plan_id', :'hid', :'recipe_id', '2026-08-18', 'lunch', 'people', 5, 4);

select is(
  (select count(*)::int from public.meal_plan_entries where meal_plan_id = :'plan_id'),
  3,
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
       values (%L, %L, %L, '2026-08-19', 'dinner', 'portions', 2) $$,
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
       values (%L, %L, %L, '2026-08-19', 'dinner', 'portions', 2, 3) $$,
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
       values (%L, %L, %L, '2026-08-19', 'dinner', 'people', 2) $$,
    :'plan_id', :'hid', :'recipe_id'
  ),
  '23514',
  null,
  'im Personen-Modus muss people_count gesetzt sein'
);

select throws_ok(
  format(
    $$ insert into public.meal_plan_entries
         (meal_plan_id, household_id, recipe_id, custom_title, entry_date, meal_slot,
          servings_mode, portions)
       values (%L, %L, %L, 'Doppelter Eintrag', '2026-08-19', 'dinner', 'portions', 2) $$,
    :'plan_id', :'hid', :'recipe_id'
  ),
  '23514',
  null,
  'ein Eintrag darf nicht gleichzeitig Rezept und Freitextgericht sein'
);

select throws_ok(
  format(
    $$ insert into public.meal_plan_entries
         (meal_plan_id, household_id, custom_title, custom_ingredients, entry_date,
          meal_slot, servings_mode, portions)
       values (%L, %L, '', '[]'::jsonb, '2026-08-19', 'dinner', 'portions', 2) $$,
    :'plan_id', :'hid'
  ),
  '23514',
  null,
  'ein Freitextgericht braucht einen nicht-leeren Namen'
);

select throws_ok(
  format(
    $$ insert into public.meal_plan_entries
         (meal_plan_id, household_id, custom_title, custom_ingredients, entry_date,
          meal_slot, servings_mode, portions)
       values (%L, %L, 'Ungültige Zutaten', '{"name":"Paprika"}'::jsonb,
               '2026-08-19', 'dinner', 'portions', 2) $$,
    :'plan_id', :'hid'
  ),
  '23514',
  null,
  'Freitext-Zutaten muessen als JSON-Array gespeichert sein'
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
