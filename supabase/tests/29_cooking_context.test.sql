begin;

\ir helpers.sql

select no_plan();

-- Testbenutzer anlegen
select tests.create_user('88888888-8888-8888-8888-888888888888', 'context-owner@example.com');
select tests.create_user('99999999-9999-9999-9999-999999999999', 'context-stranger@example.com');

-- Rechtepruefungen
select ok(
  not has_function_privilege('anon', 'public.get_cooking_context(uuid)', 'execute'),
  'anon kann get_cooking_context nicht ausfuehren'
);

select ok(
  has_function_privilege('authenticated', 'public.get_cooking_context(uuid)', 'execute'),
  'authenticated kann get_cooking_context ausfuehren'
);

-- Haushalt als Owner anlegen
select tests.authenticate_as('88888888-8888-8888-8888-888888888888');
select public.create_household('Koch-Kontext Haushalt') as household_id \gset

-- Test-Inventareintrag anlegen
insert into public.fridge_items (household_id, name, quantity, unit, expiry_date)
values (:'household_id'::uuid, 'Milch', 1, 'l', current_date + 3);

-- Test-Einkaufseintrag anlegen
insert into public.shopping_list_items (household_id, name, quantity, unit)
values (:'household_id'::uuid, 'Eier', 6, 'piece');

-- Test-Food-Rules anlegen
insert into public.profile_food_rules (user_id, allergy_codes, disliked_foods)
values ('88888888-8888-8888-8888-888888888888', array['milk'], array['Koriander']);

-- Mitglied ruft get_cooking_context ab
select throws_ok(
  format('select public.get_cooking_context(''%s''::uuid)', :'household_id'::text),
  null,
  'Haushaltsmitglied kann get_cooking_context erfolgreich aufrufen'
);

-- Validiere Rueckgabestruktur
select is(
  (public.get_cooking_context(:'household_id'::uuid)->'inventory'->>'source'),
  'inventory',
  'inventory.source ist "inventory"'
);

select ok(
  jsonb_array_length(public.get_cooking_context(:'household_id'::uuid)->'inventory'->'lots') >= 1,
  'inventory.lots enthaelt mindestens einen Eintrag'
);

select is(
  (public.get_cooking_context(:'household_id'::uuid)->'inventory'->'lots'->0->>'normalizedName'),
  'Milch',
  'Inventar-Lot enthaelt Milch'
);

select ok(
  jsonb_array_length(public.get_cooking_context(:'household_id'::uuid)->'shoppingItems') >= 1,
  'shoppingItems enthaelt mindestens einen Eintrag'
);

select is(
  (public.get_cooking_context(:'household_id'::uuid)->'shoppingItems'->0->>'name'),
  'Eier',
  'Einkaufsliste enthaelt Eier'
);

select is(
  (public.get_cooking_context(:'household_id'::uuid)->'allergies'->>0),
  'milk',
  'allergies enthaelt milk'
);

select is(
  (public.get_cooking_context(:'household_id'::uuid)->'forbiddenIngredients'->>0),
  'Koriander',
  'forbiddenIngredients enthaelt Koriander'
);

-- Test: Publiziertes Rezept mit vollstaendigen Zutaten und Allergen-Projektion
insert into public.catalog_recipes (id, external_id, slug, title, status, cook_time_minutes, default_servings, sort_order)
values ('11111111-2222-3333-4444-555555555555', 'ext-test-recipe-1', 'test-milchreis', 'Test Milchreis', 'published', 25, 2, 1);

insert into public.catalog_recipe_components (id, recipe_id, name, position)
values ('22222222-3333-4444-5555-666666666666', '11111111-2222-3333-4444-555555555555', 'Hauptkomponente', 0);

insert into public.catalog_recipe_component_items (id, component_id, recipe_id, ingredient_name, grams, quantity, unit, position)
values ('33333333-4444-5555-6666-777777777777', '22222222-3333-4444-5555-666666666666', '11111111-2222-3333-4444-555555555555', 'Vollmilch', 500, 500, 'ml', 0);

insert into public.catalog_recipe_steps (id, recipe_id, position, text)
values ('44444444-5555-6666-7777-888888888888', '11111111-2222-3333-4444-555555555555', 0, 'Milch aufkochen und Reis hinzugeben.');

-- Ingredient und Allergen-Mapping anlegen
insert into public.external_food_ingredients (id, source, source_id, canonical_name, allergen_resolution, allergen_reviewed_at)
values ('55555555-6666-7777-8888-999999999999', 'curated', 'ing-milk', 'Vollmilch', 'mapped', now());

insert into public.ingredient_allergen_mappings (ingredient_id, allergen_id, relation, confidence, reviewed_at)
values ('55555555-6666-7777-8888-999999999999', 'EU_07_MILK', 'contains', 'verified', now());

insert into public.catalog_recipe_item_ingredient_links (catalog_item_id, ingredient_id, source, source_id, source_url, source_version, license, confidence)
values ('33333333-4444-5555-6666-777777777777', '55555555-6666-7777-8888-999999999999', 'curated', 'link-milk', 'https://example.com', '1.0', 'CC-0', 'verified');

select ok(
  jsonb_array_length(public.get_cooking_context(:'household_id'::uuid)->'recipes') >= 1,
  'recipes enthaelt mindestens ein publiziertes Rezept'
);

select is(
  (public.get_cooking_context(:'household_id'::uuid)->'recipes'->0->>'title'),
  'Test Milchreis',
  'Rezept-Titel ist korrekt'
);

select is(
  (public.get_cooking_context(:'household_id'::uuid)->'recipes'->0->'allergens'->>0),
  'EU_07_MILK',
  'Rezept-Allergen EU_07_MILK korrekt projiziert'
);

-- Test: Rezept mit unvollstaendiger Zutat liefert null als Allergene
insert into public.catalog_recipes (id, external_id, slug, title, status, cook_time_minutes, default_servings, sort_order)
values ('66666666-7777-8888-9999-000000000000', 'ext-test-recipe-2', 'test-unvollstaendig', 'Test Unvollstaendig', 'published', 15, 1, 2);

insert into public.catalog_recipe_components (id, recipe_id, name, position)
values ('77777777-8888-9999-0000-111111111111', '66666666-7777-8888-9999-000000000000', 'Hauptkomponente 2', 0);

insert into public.catalog_recipe_component_items (id, component_id, recipe_id, ingredient_name, grams, quantity, unit, position)
values ('88888888-9999-0000-1111-222222222222', '77777777-8888-9999-0000-111111111111', '66666666-7777-8888-9999-000000000000', 'Unbekanntes Kraut', 10, 10, 'g', 0);

select is(
  (public.get_cooking_context(:'household_id'::uuid)->'recipes'->1->>'allergens'),
  null,
  'Rezept mit ungelinkter Zutat liefert null fuer Allergene'
);

-- Fremder Nutzer (Nicht-Mitglied) wird abgewiesen
select tests.authenticate_as('99999999-9999-9999-9999-999999999999');

select throws_matching(
  format('select public.get_cooking_context(''%s''::uuid)', :'household_id'::text),
  'household_forbidden',
  'Nicht-Mitglied erhaelt household_forbidden'
);

-- Aufruf ohne auth.uid() wird abgewiesen
select tests.clear_auth();

select throws_matching(
  format('select public.get_cooking_context(''%s''::uuid)', :'household_id'::text),
  'unauthorized',
  'Aufruf ohne Auth erhaelt unauthorized'
);

select * from finish();

rollback;
