-- Rezeptzuordnungen speichern nur gepruefte Zutatenidentitaet, nie Allergenaussagen.

begin;
\ir helpers.sql

select plan(11);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as household_id \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'household_id', '22222222-2222-2222-2222-222222222222', 'member');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.products (name, created_by)
values ('Haferdrink', '11111111-1111-1111-1111-111111111111')
returning id as product_id \gset
insert into public.products (name, created_by)
values ('Sojadrink', '11111111-1111-1111-1111-111111111111')
returning id as second_product_id \gset
insert into public.recipes (household_id, title, created_by)
values (:'household_id', 'Haferdrink', '11111111-1111-1111-1111-111111111111')
returning id as recipe_id \gset
insert into public.recipe_components (recipe_id, household_id, name)
values (:'recipe_id', :'household_id', 'Zutaten')
returning id as component_id \gset
insert into public.recipe_component_items (component_id, recipe_id, household_id, product_id, grams)
values (:'component_id', :'recipe_id', :'household_id', :'product_id', 200)
returning id as item_id \gset

select has_column(
  'public', 'recipe_component_items', 'ingredient_mapping',
  'Rezeptpositionen haben ein synchronisierbares Mapping-Feld'
);
select is(
  (select ingredient_mapping ->> 'status' from public.recipe_component_items where id = :'item_id'),
  'unknown',
  'nicht gepruefte Alt- und Neupositionen starten unknown'
);

select id as ingredient_id
from public.food_ingredients
where canonical_name = 'Sojabohnen' \gset

update public.recipe_component_items
set ingredient_source_type = 'product_label',
  ingredient_source_id = '1234567890123',
  ingredient_source_url = 'https://world.openfoodfacts.org/product/1234567890123',
  ingredient_source_version = 'off-2026-11-08',
  ingredient_source_license = 'ODbL',
  ingredient_mapping = jsonb_build_object(
  'version', 1,
  'status', 'verified',
  'ingredientIds', jsonb_build_array(:'ingredient_id'),
  'complete', true,
  'source', 'product_label',
  'sourceId', '1234567890123',
  'sourceUrl', 'https://world.openfoodfacts.org/product/1234567890123',
  'sourceVersion', 'off-2026-11-08',
  'license', 'ODbL',
  'evidenceSnapshot', 'Zutaten: Wasser, Sojabohnen',
  'reviewedAt', '2026-11-08T00:00:00Z',
  'reviewedBy', auth.uid()::text
)
where id = :'item_id';

select is(
  (select ingredient_mapping ->> 'status' from public.recipe_component_items where id = :'item_id'),
  'verified',
  'vollstaendige, belegte Zutatenidentitaet kann ein Mitglied bestaetigen'
);

select throws_ok(
  format(
    $$ update public.recipe_component_items
       set ingredient_mapping = jsonb_set(ingredient_mapping, '{complete}', 'false'::jsonb)
       where id = %L $$,
    :'item_id'
  ),
  '23514',
  'new row for relation "recipe_component_items" violates check constraint "recipe_component_item_ingredient_mapping_shape"',
  'ein Review ohne bestaetigte Vollstaendigkeit kann nicht verified sein'
);

select throws_ok(
  format(
    $$ update public.recipe_component_items
       set ingredient_mapping = jsonb_set(ingredient_mapping, '{source}', to_jsonb(%L::text))
       where id = %L $$,
    'unreviewed_source', :'item_id'
  ),
  '23514',
  'new row for relation "recipe_component_items" violates check constraint "recipe_component_item_ingredient_mapping_shape"',
  'nur festgelegte, nachvollziehbare Quellenarten sind zulaessig'
);

select throws_ok(
  format(
    $$ update public.recipe_component_items
       set ingredient_mapping = jsonb_set(ingredient_mapping, '{reviewedBy}', to_jsonb(%L::text))
       where id = %L $$,
    '22222222-2222-2222-2222-222222222222', :'item_id'
  ),
  'P0001',
  'recipe_ingredient_mapping_reviewer_must_match_user',
  'ein Mitglied kann keine andere Person als Pruefer eintragen'
);

select throws_ok(
  format(
    $$ update public.recipe_component_items
       set ingredient_mapping = ingredient_mapping || '{"allergenStatus":"clear"}'::jsonb
       where id = %L $$,
    :'item_id'
  ),
  '23514',
  'new row for relation "recipe_component_items" violates check constraint "recipe_component_item_ingredient_mapping_shape"',
  'ein Zutatenmapping kann keinen Allergenstatus oder Freistatus setzen'
);

select throws_ok(
  format(
    $$ update public.recipe_component_items
       set ingredient_mapping = jsonb_set(
         ingredient_mapping,
         '{ingredientIds}',
         jsonb_build_array(%L::text, %L::text)
       )
       where id = %L $$,
    :'ingredient_id', :'ingredient_id', :'item_id'
  ),
  'P0001',
  'recipe_ingredient_mapping_duplicate_ingredient_id',
  'mehrfache kanonische Zutaten werden abgelehnt'
);

update public.recipe_component_items
set product_id = :'second_product_id'
where id = :'item_id';
select is(
  (select ingredient_mapping ->> 'status' from public.recipe_component_items where id = :'item_id'),
  'unknown',
  'ein Produktwechsel invalidiert den alten Quellenreview automatisch'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::int from public.recipe_component_items where id = :'item_id'),
  0,
  'ein fremder Account sieht die Zutatenzuordnung des Haushalts nicht'
);
select throws_ok(
  format(
    $$ insert into public.recipe_component_items
       (component_id, recipe_id, household_id, product_id, grams)
       values (%L, %L, %L, %L, 50) $$,
    :'component_id', :'recipe_id', :'household_id', :'product_id'
  ),
  '42501',
  'new row violates row-level security policy for table "recipe_component_items"',
  'ein fremder Account kann keine Zuordnung in den Haushalt schreiben'
);

select * from finish();
rollback;
