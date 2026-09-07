-- Vertrag fuer die getrennte Ingredient-/Allergen-Wissensbasis.

begin;
\ir helpers.sql

select plan(33);

-- `supabase test db` spielt supabase/seed.sql nicht ein. Die normative
-- Taxonomie wird deshalb als transaktionales Fixture angelegt, damit dieser
-- Vertrag unabhängig von einem vorherigen `db reset` läuft.
insert into public.allergen_taxonomy
  (id, canonical_name, legal_code, source, source_id, source_url, source_version, license)
values
  ('EU_01_GLUTEN_CEREALS', 'Glutenhaltiges Getreide', 'annex-ii-01', 'eu_lmiv', '1169/2011-annex-ii-01', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_02_CRUSTACEANS', 'Krebstiere', 'annex-ii-02', 'eu_lmiv', '1169/2011-annex-ii-02', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_03_EGGS', 'Eier', 'annex-ii-03', 'eu_lmiv', '1169/2011-annex-ii-03', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_04_FISH', 'Fisch', 'annex-ii-04', 'eu_lmiv', '1169/2011-annex-ii-04', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_05_PEANUTS', 'Erdnüsse', 'annex-ii-05', 'eu_lmiv', '1169/2011-annex-ii-05', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_06_SOYBEANS', 'Sojabohnen', 'annex-ii-06', 'eu_lmiv', '1169/2011-annex-ii-06', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_07_MILK', 'Milch', 'annex-ii-07', 'eu_lmiv', '1169/2011-annex-ii-07', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_08_NUTS', 'Schalenfrüchte', 'annex-ii-08', 'eu_lmiv', '1169/2011-annex-ii-08', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_09_CELERY', 'Sellerie', 'annex-ii-09', 'eu_lmiv', '1169/2011-annex-ii-09', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_10_MUSTARD', 'Senf', 'annex-ii-10', 'eu_lmiv', '1169/2011-annex-ii-10', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_11_SESAME', 'Sesam', 'annex-ii-11', 'eu_lmiv', '1169/2011-annex-ii-11', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_12_SULPHITES', 'Schwefeldioxid und Sulfite', 'annex-ii-12', 'eu_lmiv', '1169/2011-annex-ii-12', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_13_LUPIN', 'Lupinen', 'annex-ii-13', 'eu_lmiv', '1169/2011-annex-ii-13', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text'),
  ('EU_14_MOLLUSCS', 'Weichtiere', 'annex-ii-14', 'eu_lmiv', '1169/2011-annex-ii-14', 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj', '1169/2011-annex-ii', 'EU legal text')
on conflict (id) do update set
  canonical_name = excluded.canonical_name,
  legal_code = excluded.legal_code,
  source = excluded.source,
  source_id = excluded.source_id,
  source_url = excluded.source_url,
  source_version = excluded.source_version,
  license = excluded.license;

select has_table(
  'public',
  'allergen_taxonomy',
  'die EU-Allergen-Taxonomie ist als eigene Tabelle vorhanden'
);

select has_table(
  'public',
  'external_food_ingredients',
  'kanonische externe Zutaten sind getrennt gespeichert'
);

select has_table(
  'public',
  'external_food_aliases',
  'externe Zutaten-Aliase sind getrennt gespeichert'
);

select has_table(
  'public',
  'ingredient_allergen_mappings',
  'Ingredient-to-Allergen-Mappings sind als eigene Tabelle vorhanden'
);

select is(
  (select count(*)::int from public.allergen_taxonomy),
  14,
  'die EU-Taxonomie enthält genau 14 EU-Allergengruppen'
);

select is(
  (select array_agg(id order by id) from public.allergen_taxonomy),
  array[
    'EU_01_GLUTEN_CEREALS',
    'EU_02_CRUSTACEANS',
    'EU_03_EGGS',
    'EU_04_FISH',
    'EU_05_PEANUTS',
    'EU_06_SOYBEANS',
    'EU_07_MILK',
    'EU_08_NUTS',
    'EU_09_CELERY',
    'EU_10_MUSTARD',
    'EU_11_SESAME',
    'EU_12_SULPHITES',
    'EU_13_LUPIN',
    'EU_14_MOLLUSCS'
  ]::text[],
  'die Taxonomie verwendet die vereinbarten stabilen IDs'
);

select is(
  (select array_agg(distinct source order by source) from public.allergen_taxonomy),
  array['eu_lmiv']::text[],
  'die Taxonomie hat EU-LMIV als einzige normative Quelle'
);

select has_column(
  'public',
  'external_food_ingredients',
  'allergen_resolution',
  'Zutaten unterscheiden clear, mapped und unknown'
);

select has_column(
  'public',
  'external_food_ingredients',
  'allergen_reviewed_at',
  'clear benoetigt einen eigenen Review-Zeitpunkt'
);

select has_column(
  'public',
  'external_food_ingredients',
  'foodon_id',
  'kanonische FoodOn-Referenzen sind speicherbar'
);

select has_column(
  'public',
  'external_food_aliases',
  'source_version',
  'Alias-Provenienz enthält eine Version'
);

select has_column(
  'public',
  'ingredient_allergen_mappings',
  'relation',
  'Mappings speichern die fachliche Relation'
);

select has_column(
  'public',
  'ingredient_allergen_mappings',
  'license',
  'Mappings speichern die Lizenz'
);

select has_column(
  'public',
  'ingredient_allergen_mappings',
  'reviewed_at',
  'Mappings speichern den Review-Zeitpunkt'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.allergen_taxonomy'::regclass),
  true,
  'die Taxonomie erzwingt RLS'
);

select is(
  (
    select count(*)::int
    from pg_class
    where oid in (
      'public.allergen_taxonomy'::regclass,
      'public.external_food_ingredients'::regclass,
      'public.external_food_aliases'::regclass,
      'public.ingredient_allergen_mappings'::regclass
    )
    and relrowsecurity
  ),
  4,
  'alle Wissensbanktabellen erzwingen RLS'
);

select ok(
  has_table_privilege('authenticated', 'public.external_food_ingredients', 'select')
    and not has_table_privilege('authenticated', 'public.external_food_ingredients', 'insert'),
  'Clients dürfen Wissensdaten lesen, aber nicht selbst importieren'
);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select is(
  (select count(*)::int from public.allergen_taxonomy),
  14,
  'authentifizierte Nutzer können die freigegebene Taxonomie lesen'
);

select throws_ok(
  $$ insert into public.external_food_ingredients
       (canonical_name, source, source_id, source_url, source_version, license)
     values ('Manipulierte Zutat', 'curated', 'fam:test', 'https://example.test', 'test', 'test') $$,
  '42501',
  null,
  'authentifizierte Nutzer können keine externe Zutat anlegen'
);

select tests.authenticate_as_anon();
select throws_ok(
  $$ select id from public.allergen_taxonomy $$,
  '42501',
  null,
  'anonyme Nutzer können die Wissensbasis nicht lesen'
);

select tests.as_postgres();

insert into public.external_food_ingredients (
  id,
  canonical_name,
  foodon_id,
  source,
  source_id,
  source_url,
  source_version,
  license,
  allergen_resolution,
  allergen_reviewed_at
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Tomate',
    'FOODON:03309997',
    'foodon',
    'FOODON:03309997',
  'https://foodon.org',
  'test-2026-09-05',
  'CC BY 4.0',
    'clear',
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Unbekannte Zutat',
    null,
    'curated',
    'fam:unknown',
    'https://fam.example/knowledge',
    'test-2026-09-05',
    'proprietary-curation',
    'unknown',
    null
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Mozzarella',
    'FOODON:03316048',
    'curated',
    'fam:mozzarella',
    'https://fam.example/knowledge',
    'test-2026-09-05',
    'proprietary-curation',
    'mapped',
    null
  );

select throws_ok(
  $$ insert into public.external_food_ingredients
       (canonical_name, source, source_id, source_url, source_version, license, allergen_resolution)
     values ('Ungepruefte klare Zutat', 'curated', 'fam:unreviewed-clear',
       'https://fam.example/knowledge', 'test-2026-09-05', 'proprietary-curation', 'clear') $$,
  '23514',
  null,
  'clear ohne Review-Zeitpunkt wird abgelehnt'
);

insert into public.external_food_aliases (
  ingredient_id,
  alias,
  locale,
  source,
  source_id,
  source_url,
  source_version,
  license
)
values (
  '33333333-3333-3333-3333-333333333333',
  'Mozzarella-Käse',
  'de',
  'open_food_facts',
  'off:mozzarella',
  'https://world.openfoodfacts.org',
  'test-2026-09-05',
  'ODbL-1.0'
);

insert into public.ingredient_allergen_mappings (
  ingredient_id,
  allergen_id,
  relation,
  source,
  source_id,
  source_url,
  source_version,
  license,
  confidence,
  reviewed_at
)
values (
  '33333333-3333-3333-3333-333333333333',
  'EU_07_MILK',
  'contains',
  'curated',
  'fam:mozzarella-milk',
  'https://fam.example/knowledge',
  'test-2026-09-05',
  'proprietary-curation',
  'verified',
  now()
);

select is(
  (select allergen_resolution from public.external_food_ingredients where canonical_name = 'Tomate'),
  'clear',
  'bekannt unkritische Zutat ist explizit als clear markiert'
);

select is(
  (select allergen_resolution from public.external_food_ingredients where canonical_name = 'Unbekannte Zutat'),
  'unknown',
  'fehlende Allergenkenntnis bleibt explizit unknown'
);

select is(
  (select source from public.ingredient_allergen_mappings where source_id = 'fam:mozzarella-milk'),
  'curated',
  'das Mapping bewahrt seine lokale Freigabequelle'
);

select is(
  (select confidence from public.ingredient_allergen_mappings where source_id = 'fam:mozzarella-milk'),
  'verified',
  'ein freigegebenes Mapping bewahrt seine Vertrauensstufe'
);

select is(
  (select source from public.external_food_aliases where alias = 'Mozzarella-Käse'),
  'open_food_facts',
  'Aliase bewahren den Open-Food-Facts-Provider'
);

select throws_ok(
  $$ insert into public.ingredient_allergen_mappings
       (ingredient_id, allergen_id, relation, source, source_id, source_url, source_version, license, confidence)
     values ('33333333-3333-3333-3333-333333333333', 'EU_07_MILK', 'contains', 'unknown_provider', 'x', 'https://example.test', 'x', 'x', 'external') $$,
  '23514',
  null,
  'unbekannte Provider werden abgelehnt'
);

select throws_ok(
  $$ insert into public.ingredient_allergen_mappings
       (ingredient_id, allergen_id, relation, source, source_id, source_url, source_version, license, confidence)
     values ('33333333-3333-3333-3333-333333333333', 'EU_07_MILK', 'unknown_relation', 'curated', 'x', 'https://example.test', 'x', 'x', 'external') $$,
  '23514',
  null,
  'unbekannte Mapping-Relationen werden abgelehnt'
);

select throws_ok(
  $$ insert into public.ingredient_allergen_mappings
       (ingredient_id, allergen_id, relation, source, source_id, source_url, source_version, license, confidence)
     values ('33333333-3333-3333-3333-333333333333', 'EU_07_MILK', 'contains', 'curated', 'x', 'https://example.test', 'x', 'x', 'unknown_confidence') $$,
  '23514',
  null,
  'unbekannte Vertrauensstufen werden abgelehnt'
);

select throws_ok(
  $$ insert into public.ingredient_allergen_mappings
       (ingredient_id, allergen_id, relation, source, source_id, source_url, source_version, license, confidence, reviewed_at)
     values ('33333333-3333-3333-3333-333333333333', 'EU_99_UNKNOWN', 'contains', 'curated', 'x', 'https://example.test', 'x', 'x', 'verified', now()) $$,
  '23503',
  null,
  'Mappings müssen auf eine vorhandene EU-Allergentaxonomie zeigen'
);

select throws_ok(
  $$ insert into public.ingredient_allergen_mappings
       (ingredient_id, allergen_id, relation, source, source_id, source_url, source_version, license, confidence)
     values ('33333333-3333-3333-3333-333333333333', 'EU_07_MILK', 'contains', 'curated', 'x', 'https://example.test', 'x', 'x', 'verified') $$,
  '23514',
  null,
  'verifiede Mappings benötigen einen Review-Zeitpunkt'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ insert into public.ingredient_allergen_mappings
       (ingredient_id, allergen_id, relation, source, source_id, source_url, source_version, license, confidence, reviewed_at)
     values ('33333333-3333-3333-3333-333333333333', 'EU_07_MILK', 'contains', 'curated', 'client', 'https://example.test', 'x', 'x', 'verified', now()) $$,
  '42501',
  null,
  'authentifizierte Nutzer können keine Allergen-Mappings importieren'
);

select is(
  (
    select count(*)::int
    from public.external_food_ingredients
    where source_id in ('FOODON:03309997', 'fam:unknown', 'fam:mozzarella')
  ),
  3,
  'authentifizierte Nutzer können die Test-Zutaten lesen'
);

select * from finish();
rollback;
