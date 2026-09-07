begin;

\ir helpers.sql

select plan(29);

select has_table(
  'public',
  'product_ingredient_links',
  'Produkt-Ingredient-Verknuepfungen sind vorhanden'
);
select has_table(
  'public',
  'catalog_recipe_item_ingredient_links',
  'Katalog-Ingredient-Verknuepfungen sind vorhanden'
);
select has_column(
  'public',
  'product_ingredient_links',
  'product_id',
  'Produktlink fuehrt eine Produkt-ID'
);
select has_column(
  'public',
  'product_ingredient_links',
  'ingredient_id',
  'Produktlink fuehrt eine externe Ingredient-ID'
);
select has_column(
  'public',
  'catalog_recipe_item_ingredient_links',
  'catalog_item_id',
  'Kataloglink fuehrt eine Katalogitem-ID'
);
select has_column(
  'public',
  'catalog_recipe_item_ingredient_links',
  'ingredient_id',
  'Kataloglink fuehrt eine externe Ingredient-ID'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.product_ingredient_links'::regclass),
  'Produktlinks haben RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.catalog_recipe_item_ingredient_links'::regclass),
  'Kataloglinks haben RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.product_ingredient_links', 'select'),
  'Authentifizierte Nutzer koennen Produktlinks lesen'
);
select ok(
  not has_table_privilege('authenticated', 'public.product_ingredient_links', 'insert,update,delete'),
  'Authentifizierte Nutzer koennen Produktlinks nicht veraendern'
);
select ok(
  has_table_privilege('service_role', 'public.product_ingredient_links', 'select,insert,update,delete'),
  'Service Role kann Produktlinks importieren und kuratieren'
);
select ok(
  not has_table_privilege('authenticated', 'public.catalog_recipe_item_ingredient_links', 'insert,update,delete'),
  'Authentifizierte Nutzer koennen Kataloglinks nicht veraendern'
);

select tests.as_postgres();
insert into public.products (name, source)
values ('Test-Mozzarella', 'manual')
returning id as product_id \gset

insert into public.external_food_ingredients (
  canonical_name,
  foodon_id,
  source,
  source_id,
  source_url,
  source_version,
  license,
  allergen_resolution
)
values (
  'Mozzarella',
  'FOODON:00001234',
  'foodon',
  'FOODON:00001234',
  'https://foodon.org/term/FOODON:00001234',
  '2026-01',
  'FoodOn ontology license',
  'mapped'
)
returning id as ingredient_id \gset

insert into public.catalog_recipes (
  external_id,
  slug,
  title,
  status,
  default_servings
)
values ('test-source-links', 'test-source-links', 'Test Source Links', 'published', 2)
returning id as recipe_id \gset

insert into public.catalog_recipe_components (recipe_id, name)
values (:'recipe_id', 'Hauptgericht')
returning id as component_id \gset

insert into public.catalog_recipe_component_items (
  component_id,
  recipe_id,
  ingredient_name,
  grams,
  quantity,
  unit
)
values (:'component_id', :'recipe_id', 'Mozzarella', 125, 1, 'package')
returning id as catalog_item_id \gset

reset role;

select lives_ok(
  format($$insert into public.product_ingredient_links (
    product_id, ingredient_id, source, source_id, source_url, source_version, license, confidence, reviewed_at
  ) values (%L::uuid, %L::uuid, 'open_food_facts', 'off:product:123',
    'https://world.openfoodfacts.org/product/123', '2026-01', 'ODbL-1.0', 'external', now())$$,
    :'product_id', :'ingredient_id'
  ),
  'OFF-Produktlink laesst sich mit Provenienz speichern'
);
select lives_ok(
  format($$insert into public.catalog_recipe_item_ingredient_links (
    catalog_item_id, ingredient_id, source, source_id, source_url, source_version, license, confidence, reviewed_at
  ) values (%L::uuid, %L::uuid, 'curated', 'fam:ingredient:mozzarella',
    'https://fam.local/knowledge/mozzarella', '2026-01', 'fam-curated', 'verified', now())$$,
    :'catalog_item_id', :'ingredient_id'
  ),
  'Kataloglink laesst sich als kuratierte Zuordnung speichern'
);
select is(
  (select count(*)::int from public.product_ingredient_links where product_id = :'product_id'::uuid),
  1,
  'Produktlink ist genau einmal gespeichert'
);
select is(
  (select count(*)::int from public.catalog_recipe_item_ingredient_links where catalog_item_id = :'catalog_item_id'::uuid),
  1,
  'Kataloglink ist genau einmal gespeichert'
);
select ok(
  (select source from public.product_ingredient_links where product_id = :'product_id'::uuid) = 'open_food_facts',
  'Produktlink bewahrt die OFF-Quelle'
);
select ok(
  (select confidence from public.catalog_recipe_item_ingredient_links where catalog_item_id = :'catalog_item_id'::uuid) = 'verified',
  'Kataloglink bewahrt den Review-Vertrauensstatus'
);

select tests.as_postgres();
select throws_ok(
  format($$insert into public.product_ingredient_links (
    product_id, ingredient_id, source, source_id, source_url, source_version, license, confidence, reviewed_at
  ) values (%L::uuid, %L::uuid, 'eu_lmiv', 'eu:link',
    'https://eur-lex.europa.eu/', '1169/2011', 'EU legal text', 'verified', now())$$,
    :'product_id', :'ingredient_id'
  ),
  '23514',
  null,
  'EU-LMIV bleibt Taxonomiequelle und wird nicht als Produktlink missbraucht'
);
select throws_ok(
  format($$insert into public.product_ingredient_links (
    product_id, ingredient_id, source, source_id, source_url, source_version, license, confidence
  ) values (%L::uuid, %L::uuid, 'curated', 'fam:unreviewed-product',
    'https://fam.local/blocked', '2026-01', 'fam-curated', 'verified')$$,
    :'product_id', :'ingredient_id'
  ),
  '23514',
  null,
  'Verifizierte Produktlinks benoetigen einen Review-Zeitpunkt'
);
select throws_ok(
  format($$insert into public.catalog_recipe_item_ingredient_links (
    catalog_item_id, ingredient_id, source, source_id, source_url, source_version, license, confidence, reviewed_at
  ) values (%L::uuid, %L::uuid, 'eu_lmiv', 'eu:catalog-link',
    'https://eur-lex.europa.eu/', '1169/2011', 'EU legal text', 'verified', now())$$,
    :'catalog_item_id', :'ingredient_id'
  ),
  '23514',
  null,
  'EU-LMIV bleibt Taxonomiequelle und wird nicht als Kataloglink missbraucht'
);
select throws_ok(
  format($$insert into public.catalog_recipe_item_ingredient_links (
    catalog_item_id, ingredient_id, source, source_id, source_url, source_version, license, confidence
  ) values (%L::uuid, %L::uuid, 'curated', 'fam:unreviewed-catalog',
    'https://fam.local/blocked', '2026-01', 'fam-curated', 'verified')$$,
    :'catalog_item_id', :'ingredient_id'
  ),
  '23514',
  null,
  'Verifizierte Kataloglinks benoetigen einen Review-Zeitpunkt'
);

reset role;

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  format($$select count(*) from public.product_ingredient_links where product_id = %L::uuid$$, :'product_id'),
  'Authentifizierte Nutzer sehen Produktlinks'
);
select lives_ok(
  format($$select count(*) from public.catalog_recipe_item_ingredient_links where catalog_item_id = %L::uuid$$, :'catalog_item_id'),
  'Authentifizierte Nutzer sehen Kataloglinks publizierter Rezepte'
);
select throws_ok(
  format($$insert into public.product_ingredient_links (
    product_id, ingredient_id, source, source_id, source_url, source_version, license, confidence
  ) values (%L::uuid, %L::uuid, 'curated', 'fam:client-write',
    'https://fam.local/blocked', '2026-01', 'fam-curated', 'inferred')$$,
    :'product_id', :'ingredient_id'
  ),
  '42501',
  'permission denied for table product_ingredient_links',
  'Authentifizierte Nutzer koennen keine Produktzuordnung einschleusen'
);
select throws_ok(
  format($$insert into public.catalog_recipe_item_ingredient_links (
    catalog_item_id, ingredient_id, source, source_id, source_url, source_version, license, confidence
  ) values (%L::uuid, %L::uuid, 'curated', 'fam:client-write',
    'https://fam.local/blocked', '2026-01', 'fam-curated', 'inferred')$$,
    :'catalog_item_id', :'ingredient_id'
  ),
  '42501',
  'permission denied for table catalog_recipe_item_ingredient_links',
  'Authentifizierte Nutzer koennen keine Katalogzuordnung einschleusen'
);

select tests.authenticate_as_anon();
select throws_ok(
  $$ select count(*) from public.product_ingredient_links $$,
  '42501',
  null,
  'Anonyme Nutzer haben keinen Tabellenzugriff auf Produktlinks'
);
select throws_ok(
  $$ select count(*) from public.catalog_recipe_item_ingredient_links $$,
  '42501',
  null,
  'Anonyme Nutzer haben keinen Tabellenzugriff auf Kataloglinks'
);

select throws_ok(
  format($$insert into public.product_ingredient_links (
    product_id, ingredient_id, source, source_id, source_url, source_version, license, confidence
  ) values (%L::uuid, %L::uuid, 'eu_lmiv', 'eu:link',
    'https://eur-lex.europa.eu/', '1169/2011', 'EU legal text', 'regulatory')$$,
    :'product_id', :'ingredient_id'
  ),
  '42501',
  'permission denied for table product_ingredient_links',
  'Anonyme Nutzer koennen keine Providerquelle als Link eintragen'
);

select * from finish();
rollback;
