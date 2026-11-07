-- Ingredient- und Allergenwissen ist global lesbar, aber nur serverseitig aenderbar.

begin;
\ir helpers.sql

select plan(23);

select has_table('public', 'allergen_taxonomy', 'die Allergentaxonomie existiert');
select has_table('public', 'food_ingredients', 'kanonische Zutatenidentitaeten existieren');
select has_table('public', 'ingredient_allergen_mappings', 'Allergenzuordnungen existieren');
select has_table('public', 'product_ingredient_links', 'Produkte koennen Zutaten referenzieren');
select has_table(
  'public',
  'catalog_recipe_item_ingredient_links',
  'Rezeptpositionen koennen Zutaten referenzieren'
);

select ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array[
        'allergen_taxonomy', 'food_ingredients', 'ingredient_allergen_mappings',
        'product_ingredient_links', 'catalog_recipe_item_ingredient_links'
      ])
  ),
  'RLS ist auf allen Wissens- und Linktabellen aktiviert'
);

select is(
  (select count(*)::int from public.allergen_taxonomy),
  14,
  'der Seed enthaelt alle vierzehn Allergencodes'
);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');

insert into public.products (id, name, source)
values ('22222222-2222-2222-2222-222222222201', 'Erdnussprodukt', 'manual');

insert into public.food_ingredients (id, canonical_name, allergen_reviewed_at)
values (
  '44444444-4444-4444-4444-444444444401',
  'Erdnuss',
  now()
);

insert into public.ingredient_allergen_mappings (
  id, ingredient_id, allergen_id, relation, source, source_id, source_url,
  source_version, license, confidence, reviewed_at
)
values (
  '44444444-4444-4444-4444-444444444402',
  '44444444-4444-4444-4444-444444444401',
  'EU_05_PEANUTS',
  'contains',
  'curated',
  'test:peanut-ingredient',
  'https://example.com/ingredient',
  'test-v1',
  'test-only',
  'verified',
  now()
);

insert into public.product_ingredient_links (
  id, product_id, ingredient_id, source, source_id, source_url,
  source_version, license, confidence, reviewed_at
)
values (
  '44444444-4444-4444-4444-444444444403',
  '22222222-2222-2222-2222-222222222201',
  '44444444-4444-4444-4444-444444444401',
  'curated',
  'test:product-ingredient',
  'https://example.com/product',
  'test-v1',
  'test-only',
  'verified',
  now()
);

insert into public.catalog_recipes (id, external_id, slug, title, status)
values
  ('33333333-3333-3333-3333-333333333301', 'test:published', 'test-published', 'Published test recipe', 'published'),
  ('33333333-3333-3333-3333-333333333311', 'test:draft', 'test-draft', 'Draft test recipe', 'draft');

insert into public.catalog_recipe_components (id, recipe_id, name)
values
  ('33333333-3333-3333-3333-333333333302', '33333333-3333-3333-3333-333333333301', 'Ingredients'),
  ('33333333-3333-3333-3333-333333333312', '33333333-3333-3333-3333-333333333311', 'Ingredients');

insert into public.catalog_recipe_component_items (
  id, component_id, recipe_id, ingredient_name, grams, quantity, unit
)
values
  ('33333333-3333-3333-3333-333333333303', '33333333-3333-3333-3333-333333333302', '33333333-3333-3333-3333-333333333301', 'Erdnuss', 10, 10, 'g'),
  ('33333333-3333-3333-3333-333333333313', '33333333-3333-3333-3333-333333333312', '33333333-3333-3333-3333-333333333311', 'Erdnuss', 10, 10, 'g');

insert into public.catalog_recipe_item_ingredient_links (
  id, catalog_item_id, ingredient_id, source, source_id, source_url,
  source_version, license, confidence, reviewed_at
)
values
  ('44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333303', '44444444-4444-4444-4444-444444444401', 'curated', 'test:published-recipe-item', 'https://example.com/recipe', 'test-v1', 'test-only', 'verified', now()),
  ('44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333313', '44444444-4444-4444-4444-444444444401', 'curated', 'test:draft-recipe-item', 'https://example.com/recipe', 'test-v1', 'test-only', 'verified', now());

select is(
  (select allergen_reviewed_at is not null from public.food_ingredients where id = '44444444-4444-4444-4444-444444444401'),
  true,
  'eine vollstaendig gepruefte Zutat traegt einen Review-Zeitpunkt'
);

select is(
  (select relation from public.ingredient_allergen_mappings where ingredient_id = '44444444-4444-4444-4444-444444444401'),
  'contains',
  'eine gepruefte Allergenzuordnung bleibt erhalten'
);

select is(
  (select ingredient_id from public.product_ingredient_links where product_id = '22222222-2222-2222-2222-222222222201'),
  '44444444-4444-4444-4444-444444444401'::uuid,
  'ein Produkt ist mit seiner kanonischen Zutat verknuepft'
);

select is(
  (select ingredient_id from public.catalog_recipe_item_ingredient_links where catalog_item_id = '33333333-3333-3333-3333-333333333303'),
  '44444444-4444-4444-4444-444444444401'::uuid,
  'eine Rezeptposition ist mit ihrer kanonischen Zutat verknuepft'
);

select throws_ok(
  $$ insert into public.food_ingredients (canonical_name) values ('ERDNUSS') $$,
  '23505',
  null,
  'kanonische Namen sind ohne Beachtung der Grossschreibung eindeutig'
);

select throws_ok(
  $$ insert into public.allergen_taxonomy (id, sort_order) values ('EU_99_UNKNOWN', 99) $$,
  '23514',
  null,
  'unbekannte Allergencodes werden abgelehnt'
);

select ok(
  (
    select bool_and(
      has_table_privilege('authenticated', table_name::regclass, 'select')
      and not has_table_privilege('authenticated', table_name::regclass, 'insert')
      and not has_table_privilege('authenticated', table_name::regclass, 'update')
      and not has_table_privilege('authenticated', table_name::regclass, 'delete')
    )
    from unnest(array[
      'public.allergen_taxonomy', 'public.food_ingredients',
      'public.ingredient_allergen_mappings', 'public.product_ingredient_links',
      'public.catalog_recipe_item_ingredient_links'
    ]) as tables(table_name)
  ),
  'Angemeldete Nutzer erhalten nur Leserechte auf den Wissensdaten'
);

select ok(
  (
    select bool_and(
      has_table_privilege('service_role', table_name::regclass, 'select')
      and has_table_privilege('service_role', table_name::regclass, 'insert')
      and has_table_privilege('service_role', table_name::regclass, 'update')
      and has_table_privilege('service_role', table_name::regclass, 'delete')
    )
    from unnest(array[
      'public.allergen_taxonomy', 'public.food_ingredients',
      'public.ingredient_allergen_mappings', 'public.product_ingredient_links',
      'public.catalog_recipe_item_ingredient_links'
    ]) as tables(table_name)
  ),
  'Der serverseitige Dienst darf die Wissensdaten verwalten'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select is((select count(*)::int from public.allergen_taxonomy), 14, 'Angemeldete Nutzer sehen die Taxonomie');
select is((select count(*)::int from public.food_ingredients), 1, 'Angemeldete Nutzer sehen die kanonische Zutat');
select is((select count(*)::int from public.ingredient_allergen_mappings), 1, 'Angemeldete Nutzer sehen die Allergenfakten');
select is((select count(*)::int from public.product_ingredient_links), 1, 'Angemeldete Nutzer sehen die Produktzuordnung');
select is((select count(*)::int from public.catalog_recipe_item_ingredient_links), 1, 'Angemeldete Nutzer sehen Zuordnungen publizierter Rezepte');

select is(
  (select count(*)::int from public.catalog_recipe_item_ingredient_links where catalog_item_id = '33333333-3333-3333-3333-333333333313'),
  0,
  'Rezeptzutaten aus Entwuerfen bleiben unsichtbar'
);

select throws_ok(
  $$ insert into public.food_ingredients (canonical_name) values ('Bob''s Zutat') $$,
  '42501',
  null,
  'Angemeldete Nutzer koennen keine globalen Zutaten anlegen'
);

select tests.authenticate_as_anon();
select throws_ok(
  $$ select * from public.allergen_taxonomy $$,
  '42501',
  null,
  'anonyme Nutzer haben keinen Zugriff auf die Taxonomie'
);

select tests.as_postgres();
select * from finish();
rollback;
