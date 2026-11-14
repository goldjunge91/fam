-- Zutatenwissen bleibt quellenbelegt, versioniert und fuer Clients read-only.

begin;
\ir helpers.sql

select plan(34);

select has_table('public', 'allergen_taxonomy', 'die EU-Allergentaxonomie existiert');
select has_table('public', 'food_ingredients', 'kanonische Zutatenidentitaeten existieren');
select has_table('public', 'food_ingredient_aliases', 'quellenbelegte Zutaten-Aliase existieren');
select has_table(
  'public',
  'ingredient_allergen_assessments',
  'quellenbelegte Allergenpruefungen existieren'
);

select ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array[
        'allergen_taxonomy', 'food_ingredients', 'food_ingredient_aliases',
        'ingredient_allergen_assessments'
      ])
  ),
  'RLS ist auf allen Zutatenwissen-Tabellen aktiviert'
);

select is(
  (
    select array_agg(id order by sort_order)
    from public.allergen_taxonomy
  ),
  array[
    'EU_01_GLUTEN_CEREALS', 'EU_02_CRUSTACEANS', 'EU_03_EGGS', 'EU_04_FISH',
    'EU_05_PEANUTS', 'EU_06_SOYBEANS', 'EU_07_MILK', 'EU_08_NUTS',
    'EU_09_CELERY', 'EU_10_MUSTARD', 'EU_11_SESAME', 'EU_12_SULPHITES',
    'EU_13_LUPIN', 'EU_14_MOLLUSCS'
  ]::text[],
  'die Taxonomie enthaelt exakt die 14 EU-Gruppen in Rechtsreihenfolge'
);

select is(
  (
    with expected(allergen_id, profile_rule) as (
      values
        ('EU_01_GLUTEN_CEREALS', 'gluten-containing-cereals'),
        ('EU_02_CRUSTACEANS', 'crustaceans'),
        ('EU_03_EGGS', 'eggs'),
        ('EU_04_FISH', 'fish'),
        ('EU_05_PEANUTS', 'peanuts'),
        ('EU_06_SOYBEANS', 'soybeans'),
        ('EU_07_MILK', 'milk'),
        ('EU_08_NUTS', 'tree-nuts'),
        ('EU_09_CELERY', 'celery'),
        ('EU_10_MUSTARD', 'mustard'),
        ('EU_11_SESAME', 'sesame'),
        ('EU_12_SULPHITES', 'sulphur-dioxide-sulphites'),
        ('EU_13_LUPIN', 'lupin'),
        ('EU_14_MOLLUSCS', 'molluscs')
    ),
    constraint_definition as (
      select pg_get_constraintdef(oid) as definition
      from pg_constraint
      where conrelid = 'public.profile_food_rules'::regclass
        and conname = 'profile_food_rules_allergy_codes_allowed'
    )
    select count(*)::integer
    from expected
    cross join constraint_definition
    where not exists (
      select 1 from public.allergen_taxonomy where id = expected.allergen_id
    )
      or position(quote_literal(expected.profile_rule) in constraint_definition.definition) = 0
  ),
  0,
  'jede EU-Gruppe ist dem passenden bestehenden Profil-Allergiecode zugeordnet'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_allergen_assessments
    where source = 'eu_lmiv'
      and source_version = '02011R1169-20250401'
      and assessment = 'contains'
  ),
  28,
  'der kuratierte Startbestand hat 28 direkt belegte positive Zutatenfakten'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_allergen_assessments assessment
    join public.food_ingredients ingredient on ingredient.id = assessment.ingredient_id
    where assessment.source = 'eu_lmiv'
      and assessment.source_version = '02011R1169-20250401'
      and (
        assessment.confidence <> 'verified'
        or assessment.reviewed_at is null
        or assessment.reviewed_by = ''
        or assessment.source_id = ''
        or assessment.source_url = ''
        or assessment.license = ''
        or assessment.review_scope = ''
        or assessment.evidence_snapshot = ''
        or assessment.ingredient_revision <> ingredient.revision
      )
  ),
  0,
  'jeder Quellenfakt hat Reviewbeleg und entspricht der aktuellen Zutatenrevision'
);

select is(
  (
    select count(*)::integer
    from public.food_ingredient_aliases
    where source = 'eu_lmiv'
      and source_version = '02011R1169-20250401'
      and (
        confidence <> 'verified'
        or reviewed_at is null
        or reviewed_by = ''
        or source_id = ''
        or source_url = ''
        or license = ''
      )
  ),
  0,
  'jeder kuratierte Alias hat Quelle und Reviewnachweis'
);

select is(
  (
    select ingredient.canonical_name
    from public.food_ingredient_aliases alias
    join public.food_ingredients ingredient on ingredient.id = alias.ingredient_id
    where alias.alias = 'Weizenmehl'
      and alias.source_version = '02011R1169-20250401'
  ),
  'Weizen',
  'ein direkt belegtes Weizenprodukt wird dem kanonischen Weizen zugeordnet'
);

select is(
  (
    select count(*)::integer
    from public.food_ingredient_aliases
    where lower(alias) in ('nuss', 'nüsse')
      and source_version = '02011R1169-20250401'
  ),
  0,
  'mehrdeutige Sammelbegriffe wie Nuss werden nicht automatisch zugeordnet'
);

select is(
  (
    with expected(canonical_name, allergen_id) as (
      values
        ('Weizen', 'EU_01_GLUTEN_CEREALS'),
        ('Dinkel', 'EU_01_GLUTEN_CEREALS'),
        ('Khorasanweizen', 'EU_01_GLUTEN_CEREALS'),
        ('Roggen', 'EU_01_GLUTEN_CEREALS'),
        ('Gerste', 'EU_01_GLUTEN_CEREALS'),
        ('Hafer', 'EU_01_GLUTEN_CEREALS'),
        ('Krebstiere', 'EU_02_CRUSTACEANS'),
        ('Eier', 'EU_03_EGGS'),
        ('Fische', 'EU_04_FISH'),
        ('Erdnüsse', 'EU_05_PEANUTS'),
        ('Sojabohnen', 'EU_06_SOYBEANS'),
        ('Milch', 'EU_07_MILK'),
        ('Laktose', 'EU_07_MILK'),
        ('Mandeln', 'EU_08_NUTS'),
        ('Haselnüsse', 'EU_08_NUTS'),
        ('Walnüsse', 'EU_08_NUTS'),
        ('Cashewkerne', 'EU_08_NUTS'),
        ('Pekannüsse', 'EU_08_NUTS'),
        ('Paranüsse', 'EU_08_NUTS'),
        ('Pistazien', 'EU_08_NUTS'),
        ('Macadamianüsse', 'EU_08_NUTS'),
        ('Sellerie', 'EU_09_CELERY'),
        ('Senf', 'EU_10_MUSTARD'),
        ('Sesamsamen', 'EU_11_SESAME'),
        ('Schwefeldioxid', 'EU_12_SULPHITES'),
        ('Sulfite', 'EU_12_SULPHITES'),
        ('Lupinen', 'EU_13_LUPIN'),
        ('Weichtiere', 'EU_14_MOLLUSCS')
    )
    select count(*)::integer
    from expected
    where not exists (
      select 1
      from public.food_ingredients ingredient
      join public.ingredient_allergen_assessments assessment
        on assessment.ingredient_id = ingredient.id
      where ingredient.canonical_name = expected.canonical_name
        and assessment.allergen_id = expected.allergen_id
        and assessment.assessment = 'contains'
        and assessment.source = 'eu_lmiv'
        and assessment.source_version = '02011R1169-20250401'
    )
  ),
  0,
  'alle direkt benannten Grundzutaten sind der richtigen EU-Gruppe zugeordnet'
);

select is(
  (
    select count(*)::integer
    from public.ingredient_allergen_assessments
    where source = 'eu_lmiv'
      and source_version = '02011R1169-20250401'
      and assessment = 'not_detected'
  ),
  0,
  'die positive EU-Liste erzeugt keine allergenfreien Befunde'
);

insert into public.food_ingredients (id, canonical_name)
values
  ('44444444-4444-4444-4444-444444444401', 'Erdnuss'),
  ('44444444-4444-4444-4444-444444444402', 'Kartoffel');

select is(
  (
    select count(*)::integer
    from public.ingredient_allergen_assessments
    where ingredient_id = '44444444-4444-4444-4444-444444444402'
  ),
  0,
  'eine Zutat ohne explizite Pruefung hat kein Freispruch-Faktum und bleibt unknown'
);

insert into public.food_ingredient_aliases (
  id, ingredient_id, alias, locale, source, source_id, source_url,
  source_version, license, confidence, reviewed_at, reviewed_by
)
values (
  '44444444-4444-4444-4444-444444444403',
  '44444444-4444-4444-4444-444444444401',
  'Erdnüsse',
  'de',
  'eu_lmiv',
  'test:annex-ii-peanuts',
  'https://example.test/annex-ii',
  'test-v1',
  'test-only',
  'verified',
  now(),
  'test-reviewer'
);

insert into public.ingredient_allergen_assessments (
  id, ingredient_id, ingredient_revision, allergen_id, assessment, source,
  source_id, source_url, source_version, license, review_scope,
  evidence_snapshot, confidence, reviewed_at, reviewed_by
)
values (
  '44444444-4444-4444-4444-444444444404',
  '44444444-4444-4444-4444-444444444401',
  1,
  'EU_05_PEANUTS',
  'contains',
  'eu_lmiv',
  'test:annex-ii-peanuts',
  'https://example.test/annex-ii',
  'test-v1',
  'test-only',
  'Testbeleg: Zutatenidentitaet Erdnuss gegen EU-Gruppe 5 geprueft.',
  'Test-Snapshot: Erdnuesse und daraus gewonnene Erzeugnisse.',
  'verified',
  now(),
  'test-reviewer'
);

insert into public.ingredient_allergen_assessments (
  id, ingredient_id, ingredient_revision, allergen_id, assessment, source,
  source_id, source_url, source_version, license, review_scope,
  evidence_snapshot, confidence, reviewed_at, reviewed_by
)
values (
  '44444444-4444-4444-4444-444444444405',
  '44444444-4444-4444-4444-444444444402',
  1,
  'EU_03_EGGS',
  'not_detected',
  'curated',
  'test:potato-clear-review',
  'https://example.test/potato-review',
  'test-v1',
  'test-only',
  'Testbeleg: klarer Befund ausschliesslich fuer diesen Pruefumfang.',
  'Test-Snapshot: gepruefte Kartoffel-Zutatenquelle ohne Ei-Angabe.',
  'verified',
  now(),
  'test-reviewer'
);

select is(
  (select confidence from public.food_ingredient_aliases
   where id = '44444444-4444-4444-4444-444444444403'),
  'verified',
  'ein bestaetigter Alias hat einen Reviewzeitpunkt und Reviewer'
);

select is(
  (select assessment from public.ingredient_allergen_assessments
   where id = '44444444-4444-4444-4444-444444444404'),
  'contains',
  'ein belegter positiver Allergenfakt wird gespeichert'
);

select is(
  (select ingredient_revision from public.ingredient_allergen_assessments
   where id = '44444444-4444-4444-4444-444444444404'),
  1,
  'ein Fakt speichert die gepruefte Revision seiner Zutat'
);

select ok(
  (
    select source_id <> '' and source_url <> '' and source_version <> ''
      and license <> '' and review_scope <> '' and evidence_snapshot <> ''
      and reviewed_at is not null and reviewed_by <> ''
    from public.ingredient_allergen_assessments
    where id = '44444444-4444-4444-4444-444444444404'
  ),
  'ein positiver Fakt traegt vollstaendige Provenienz und Reviewdaten'
);

select is(
  (select assessment from public.ingredient_allergen_assessments
   where id = '44444444-4444-4444-4444-444444444405'),
  'not_detected',
  'ein klares Ergebnis ist nur als explizite gepruefte Faktzeile gespeichert'
);

select throws_ok(
  $$ insert into public.ingredient_allergen_assessments (
       ingredient_id, ingredient_revision, allergen_id, assessment, source,
       source_id, source_url, source_version, license, review_scope,
       evidence_snapshot, confidence
     ) values (
       '44444444-4444-4444-4444-444444444401', 1, 'EU_05_PEANUTS', 'contains',
       'curated', 'test:missing-reviewer', 'https://example.test', 'test-v1',
       'test-only', 'scope', 'snapshot', 'verified'
     ) $$,
  '23514',
  null,
  'verifizierte Fakten ohne Reviewzeitpunkt und Reviewer werden abgelehnt'
);

select throws_ok(
  $$ insert into public.ingredient_allergen_assessments (
       ingredient_id, ingredient_revision, allergen_id, assessment, source,
       source_id, source_url, source_version, license, review_scope,
       evidence_snapshot, confidence
     ) values (
       '44444444-4444-4444-4444-444444444402', 1, 'EU_03_EGGS', 'not_detected',
       'curated', 'test:unverified-clear', 'https://example.test', 'test-v1',
       'test-only', 'scope', 'snapshot', 'external'
     ) $$,
  '23514',
  null,
  'not_detected wird ohne verifizierten Review abgelehnt'
);

select throws_ok(
  $$ insert into public.ingredient_allergen_assessments (
       ingredient_id, ingredient_revision, allergen_id, assessment, source,
       source_id, source_url, source_version, license, review_scope,
       evidence_snapshot, confidence, reviewed_at, reviewed_by
     ) values (
       '44444444-4444-4444-4444-444444444401', 1, 'EU_05_PEANUTS', 'contains',
       'curated', 'test:empty-evidence', 'https://example.test', 'test-v1',
       'test-only', 'scope', ' ', 'verified', now(), 'test-reviewer'
     ) $$,
  '23514',
  null,
  'ein leerer Evidenz-Snapshot wird abgelehnt'
);

update public.food_ingredients
set canonical_name = 'Erdnuss (botanische Identitaet)'
where id = '44444444-4444-4444-4444-444444444401';

select is(
  (select revision from public.food_ingredients
   where id = '44444444-4444-4444-4444-444444444401'),
  2,
  'eine Aenderung der kanonischen Identitaet erhoeht ihre Revision'
);

select ok(
  (
    select assessment.ingredient_revision < ingredient.revision
    from public.ingredient_allergen_assessments assessment
    join public.food_ingredients ingredient on ingredient.id = assessment.ingredient_id
    where assessment.id = '44444444-4444-4444-4444-444444444404'
  ),
  'Fakten mit einer aelteren Zutatenrevision sind als stale erkennbar'
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
      'public.food_ingredient_aliases', 'public.ingredient_allergen_assessments'
    ]) as tables(table_name)
  ),
  'angemeldete Nutzer haben nur Leserechte auf der globalen Zutatenbasis'
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
      'public.food_ingredient_aliases', 'public.ingredient_allergen_assessments'
    ]) as tables(table_name)
  ),
  'nur der serverseitige Dienst hat Pflege-Rechte auf der globalen Zutatenbasis'
);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'allergens@example.com');
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select is((select count(*)::integer from public.allergen_taxonomy), 14, 'Clients sehen die Taxonomie');
select is(
  (select count(*)::integer from public.food_ingredients
   where id in ('44444444-4444-4444-4444-444444444401', '44444444-4444-4444-4444-444444444402')),
  2,
  'angemeldete Nutzer sehen die Testzutaten'
);
select is(
  (select count(*)::integer from public.food_ingredient_aliases where source_id like 'test:%'),
  1,
  'angemeldete Nutzer sehen den Testalias'
);
select is(
  (select count(*)::integer from public.ingredient_allergen_assessments where source_id like 'test:%'),
  2,
  'angemeldete Nutzer sehen die Testfakten'
);

select throws_ok(
  $$ insert into public.food_ingredients (canonical_name) values ('Neue Zutat') $$,
  '42501',
  null,
  'angemeldete Nutzer koennen keine globalen Zutaten anlegen'
);

select throws_ok(
  $$ update public.ingredient_allergen_assessments
     set assessment = 'not_detected'
     where id = '44444444-4444-4444-4444-444444444404' $$,
  '42501',
  null,
  'angemeldete Nutzer koennen kuratierte Fakten nicht aendern'
);

select tests.authenticate_as_anon();
select throws_ok(
  $$ select * from public.allergen_taxonomy $$,
  '42501',
  null,
  'anonyme Nutzer haben keinen Zugriff auf die Allergentaxonomie'
);

select tests.as_postgres();
select * from finish();
rollback;
