-- recipes, recipe_components, recipe_component_items (#123).

begin;
\ir helpers.sql

select plan(16);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'member');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

insert into public.products (name, kcal_per_100, created_by)
values ('Tomaten', 30, '11111111-1111-1111-1111-111111111111')
returning id as tomaten_id \gset

insert into public.products (name, kcal_per_100, created_by)
values ('Hackfleisch', 100, '11111111-1111-1111-1111-111111111111')
returning id as hack_id \gset

insert into public.recipes (household_id, title, instructions, created_by)
values (:'hid', 'Spaghetti Bolognese', 'Kochen.', '11111111-1111-1111-1111-111111111111')
returning id as recipe_id \gset

insert into public.recipe_components (recipe_id, household_id, name, serving_grams)
values (:'recipe_id', :'hid', 'Soße', 200)
returning id as sauce_id \gset

insert into public.recipe_components (recipe_id, household_id, name)
values (:'recipe_id', :'hid', 'Nudeln-Basis')
returning id as noodle_base_id \gset

-- ------------------------------------------------------- geteilt im Haushalt
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.recipes),
  1,
  'ein anderes Haushaltsmitglied sieht das Rezept'
);

insert into public.recipe_component_items (component_id, recipe_id, household_id, product_id, grams)
values (:'sauce_id', :'recipe_id', :'hid', :'tomaten_id', 50)
returning id as tomaten_item_id \gset

insert into public.recipe_component_items (component_id, recipe_id, household_id, product_id, grams)
values (:'sauce_id', :'recipe_id', :'hid', :'hack_id', 300);

select is(
  (select count(*)::int from public.recipe_component_items where component_id = :'sauce_id'),
  2,
  'jedes Mitglied darf Positionen zu einer geteilten Komponente hinzufuegen'
);

-- Unterkomponente: "Nudeln-Basis" verwendet "Soße" als Position.
insert into public.recipe_component_items (component_id, recipe_id, household_id, sub_component_id, grams)
values (:'noodle_base_id', :'recipe_id', :'hid', :'sauce_id', 200);

select is(
  (
    select sub_component_id from public.recipe_component_items
    where component_id = :'noodle_base_id'
  ),
  :'sauce_id'::uuid,
  'eine Position kann auf eine Unterkomponente desselben Rezepts verweisen'
);

-- ------------------------------------------------------------- Aussenstehende
select tests.authenticate_as('33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.recipes),
  0,
  'Aussenstehende sehen fremde Rezepte nicht'
);

select throws_ok(
  format(
    $$ insert into public.recipes (household_id, title, created_by)
       values (%L, 'eingeschleust', '33333333-3333-3333-3333-333333333333') $$,
    :'hid'
  ),
  '42501',
  'new row violates row-level security policy for table "recipes"',
  'Aussenstehende koennen kein Rezept in einen fremden Haushalt einschleusen'
);

-- --------------------------------------------------------- Check-Constraint
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

-- component_id/sub_component_id absichtlich so gewaehlt, dass die Kombination
-- keinen Zykel ergibt (noodle_base_id -> sauce_id existiert schon als echte
-- Position) — sonst würde der Konsistenz-Trigger vor dem Check feuern.
select throws_ok(
  format(
    $$ insert into public.recipe_component_items
         (component_id, recipe_id, household_id, product_id, sub_component_id, grams)
       values (%L, %L, %L, %L, %L, 10) $$,
    :'noodle_base_id', :'recipe_id', :'hid', :'tomaten_id', :'sauce_id'
  ),
  '23514',
  null,
  'eine Position darf nicht gleichzeitig Zutat und Unterkomponente referenzieren'
);

select throws_ok(
  format(
    $$ insert into public.recipe_component_items
         (component_id, recipe_id, household_id, grams)
       values (%L, %L, %L, 10) $$,
    :'sauce_id', :'recipe_id', :'hid'
  ),
  '23514',
  null,
  'eine Position braucht mindestens eine Zutat oder Unterkomponente'
);

-- --------------------------------------------------------- Konsistenz-Trigger
select throws_ok(
  format(
    $$ insert into public.recipe_component_items
         (component_id, recipe_id, household_id, sub_component_id, grams)
       values (%L, %L, %L, %L, 10) $$,
    :'sauce_id', :'recipe_id', :'hid', :'sauce_id'
  ),
  'P0001',
  'Eine Komponente kann sich nicht selbst als Unterkomponente enthalten',
  'eine Komponente darf sich nicht selbst als Unterkomponente enthalten'
);

-- Zykel: "Soße" enthaelt bereits "Nudeln-Basis" (ueber die obige Position) NICHT
-- direkt — sondern umgekehrt enthaelt "Nudeln-Basis" "Soße". Ein Versuch, jetzt
-- "Soße" wiederum "Nudeln-Basis" enthalten zu lassen, waere ein 2-Hop-Zykel.
select throws_ok(
  format(
    $$ insert into public.recipe_component_items
         (component_id, recipe_id, household_id, sub_component_id, grams)
       values (%L, %L, %L, %L, 10) $$,
    :'sauce_id', :'recipe_id', :'hid', :'noodle_base_id'
  ),
  'P0001',
  'Diese Zuordnung wuerde eine zyklische Komponenten-Verschachtelung erzeugen',
  'eine zyklische Komponenten-Verschachtelung wird abgelehnt'
);

-- Ein zweites Rezept, um die Rezept-Grenze der Unterkomponenten-Pruefung zu testen.
insert into public.recipes (household_id, title, created_by)
values (:'hid', 'Anderes Rezept', '11111111-1111-1111-1111-111111111111')
returning id as other_recipe_id \gset

insert into public.recipe_components (recipe_id, household_id, name)
values (:'other_recipe_id', :'hid', 'Fremde Komponente')
returning id as foreign_component_id \gset

select throws_ok(
  format(
    $$ insert into public.recipe_component_items
         (component_id, recipe_id, household_id, sub_component_id, grams)
       values (%L, %L, %L, %L, 10) $$,
    :'sauce_id', :'recipe_id', :'hid', :'foreign_component_id'
  ),
  'P0001',
  'Unterkomponente gehoert zu einem anderen Rezept',
  'eine Unterkomponente aus einem fremden Rezept wird abgelehnt'
);

-- ------------------------------------------------------------ recipe_steps
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

insert into public.recipe_steps (recipe_id, household_id, position, text)
values (:'recipe_id', :'hid', 0, 'Wasser fuer die Nudeln aufsetzen.')
returning id as step_id \gset

insert into public.recipe_step_ingredients (step_id, item_id, household_id)
values (:'step_id', :'tomaten_item_id', :'hid');

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.recipe_steps where recipe_id = :'recipe_id'),
  1,
  'ein anderes Haushaltsmitglied sieht den Zubereitungsschritt'
);

select is(
  (select count(*)::int from public.recipe_step_ingredients where step_id = :'step_id'),
  1,
  'ein anderes Haushaltsmitglied sieht die Zutaten-Referenz des Schritts'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');

select throws_ok(
  format(
    $$ insert into public.recipe_steps (recipe_id, household_id, position, text)
       values (%L, %L, 1, 'eingeschleust') $$,
    :'recipe_id', :'hid'
  ),
  '42501',
  'new row violates row-level security policy for table "recipe_steps"',
  'Aussenstehende koennen keinen Zubereitungsschritt in ein fremdes Rezept einschleusen'
);

-- storage.objects liegt ausserhalb dessen, was `db diff` erfasst (siehe
-- Kommentar in 12_recipe_storage.sql) — dieser Test schlaegt an, wenn die
-- Policies nach einem Reset/Push nicht manuell nachgezogen wurden.
select set_eq(
  $$ select policyname from pg_policies where tablename = 'objects' and policyname like 'recipe_covers_%' $$,
  $$ values ('recipe_covers_select'), ('recipe_covers_insert'), ('recipe_covers_update'), ('recipe_covers_delete') $$,
  'RLS-Policies fuer den recipe-covers-Bucket sind vorhanden (siehe 12_recipe_storage.sql)'
);

select like(
  (
    select qual
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'recipe_covers_select'
  ),
  '%templates%',
  'Template-Cover sind fuer authentifizierte Nutzer lesbar'
);

select set_eq(
  $$ select policyname from pg_policies where tablename = 'objects' and policyname like 'recipe_step_images_%' $$,
  $$ values ('recipe_step_images_select'), ('recipe_step_images_insert'), ('recipe_step_images_update'), ('recipe_step_images_delete') $$,
  'RLS-Policies fuer den recipe-step-images-Bucket sind vorhanden (siehe 13_recipe_step_storage.sql)'
);

select * from finish();
rollback;
