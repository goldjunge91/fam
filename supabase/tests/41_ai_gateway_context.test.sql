-- AI-Gateway-Kontext: relationale Produktauflösung, Index und Haushaltsgrenze.

begin;
\ir helpers.sql

select plan(9);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'context-alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'context-bob@example.com');
select tests.as_postgres();

insert into public.households (id, name, created_by)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Haushalt Alice', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Haushalt Bob', '22222222-2222-2222-2222-222222222222');
insert into public.household_members (household_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'admin');

insert into public.products (id, name)
values ('33333333-3333-3333-3333-333333333333', 'Tomate');

insert into public.catalog_recipes (id, external_id, slug, title, status)
values
  ('44444444-4444-4444-4444-444444444444', 'context:published', 'context-published', 'Tomatenpfanne', 'published'),
  ('55555555-5555-5555-5555-555555555555', 'context:draft', 'context-draft', 'Entwurf', 'draft');
insert into public.catalog_recipe_components (id, recipe_id, name)
values ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 'Hauptzutat');
insert into public.catalog_recipe_component_items (
  id, component_id, recipe_id, product_id, grams, quantity, unit
)
values (
  '77777777-7777-7777-7777-777777777777',
  '66666666-6666-6666-6666-666666666666',
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  100,
  1,
  'piece'
);

insert into public.recipes (id, household_id, title, created_by)
values
  ('88888888-8888-8888-8888-888888888888', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice Rezept', '11111111-1111-1111-1111-111111111111'),
  ('99999999-9999-9999-9999-999999999999', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bob Rezept', '22222222-2222-2222-2222-222222222222');
insert into public.recipe_components (id, recipe_id, household_id, name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', '88888888-8888-8888-8888-888888888888', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice Komponente'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc', '99999999-9999-9999-9999-999999999999', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bob Komponente');
insert into public.recipe_component_items (
  id, component_id, recipe_id, household_id, product_id, grams, quantity, unit
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab',
    '88888888-8888-8888-8888-888888888888',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    100,
    1,
    'piece'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbd',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc',
    '99999999-9999-9999-9999-999999999999',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '33333333-3333-3333-3333-333333333333',
    100,
    1,
    'piece'
  );

insert into public.meal_plans (id, household_id, name, week_start_date, created_by)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bob Woche', '2026-11-09', '22222222-2222-2222-2222-222222222222');
insert into public.meal_plan_entries (
  id, meal_plan_id, household_id, recipe_id, entry_date, meal_slot, portions, created_by
)
values (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '99999999-9999-9999-9999-999999999999',
  '2026-11-09',
  'dinner',
  2,
  '22222222-2222-2222-2222-222222222222'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select is(
  (
    select p.name
    from public.catalog_recipe_component_items item
    join public.products p on p.id = item.product_id
    where item.recipe_id = '44444444-4444-4444-4444-444444444444'
  ),
  'Tomate',
  'der Product-Fremdschlüssel liefert den relationalen Namen'
);
select is_empty(
  $$ select id from public.catalog_recipes where status = 'draft' $$,
  'nicht veröffentlichte Katalogrezepte bleiben unsichtbar'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'catalog_recipe_items_product_recipe_position_idx'
  ),
  'der Product-basierte Katalogzugriff besitzt den deklarativen Index'
);
select is(
  (select count(*)::int from public.recipes),
  1,
  'ein Mitglied sieht nur Haushaltsrezepte des eigenen Haushalts'
);
select is_empty(
  $$ select id from public.recipe_components where household_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  'Komponenten des Fremdhaushalts bleiben durch RLS unsichtbar'
);
select is_empty(
  $$ select id from public.recipe_component_items where household_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  'Zutatenpositionen des Fremdhaushalts bleiben durch RLS unsichtbar'
);
select is_empty(
  $$ select id from public.meal_plan_entries where household_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  'Wochenplaneinträge des Fremdhaushalts bleiben durch RLS unsichtbar'
);
select is(
  (select title from public.recipes where id = '88888888-8888-8888-8888-888888888888'),
  'Alice Rezept',
  'das eigene Haushaltsrezept bleibt verfügbar'
);
select is_empty(
  $$ select id from public.catalog_recipe_component_items where recipe_id = '55555555-5555-5555-5555-555555555555' $$,
  'Komponenten eines nicht veröffentlichten Katalogrezepts bleiben unsichtbar'
);

select * from finish();
rollback;
