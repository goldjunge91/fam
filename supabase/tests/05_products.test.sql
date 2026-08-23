-- products: global lesbar, aber nur eigene manuelle Eintraege aenderbar (#38, #43).

begin;
\ir helpers.sql

select plan(9);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');

insert into public.products (barcode, name, kcal_per_100, source, created_by)
values
  ('4001234567890', 'Haferflocken', 372, 'off', '11111111-1111-1111-1111-111111111111'),
  (null, 'Apfel vom Markt', 52, 'manual', '11111111-1111-1111-1111-111111111111');

-- Nur Alices Zeile zaehlen, weil Seeds weitere globale Produkte anlegen.
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.products where created_by = '11111111-1111-1111-1111-111111111111'),
  2,
  'Bob sieht auch Produkte, die Alice angelegt hat'
);

update public.products set name = 'gekapert' where barcode = '4001234567890';
update public.products set name = 'gekapert' where created_by = '11111111-1111-1111-1111-111111111111' and source = 'manual';

select tests.as_postgres();
select is_empty(
  $$ select id from public.products where name = 'gekapert' $$,
  'Bob kann fremde Produkte nicht aendern — weder importierte noch manuelle'
);

-- created_by grenzt Alices manuelles Produkt von Seed-Produkten ab.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
update public.products set name = 'Apfel, korrigiert'
  where created_by = '11111111-1111-1111-1111-111111111111' and source = 'manual';

select tests.as_postgres();
select is(
  (select name from public.products where created_by = '11111111-1111-1111-1111-111111111111' and source = 'manual'),
  'Apfel, korrigiert',
  'Alice kann ihr eigenes manuelles Produkt korrigieren'
);

-- Auch der Importeur darf ein global geteiltes OFF-Produkt nicht aendern.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
update public.products set name = 'OFF veraendert' where barcode = '4001234567890';

select tests.as_postgres();
select is(
  (select name from public.products where barcode = '4001234567890'),
  'Haferflocken',
  'auch der Anleger kann ein importiertes Produkt nicht aendern'
);

-- Clients duerfen keine OFF-Taxonomie als globale Wahrheit setzen.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ insert into public.products
       (barcode, name, source, created_by, off_category_tags)
     values
       ('4000000000001', 'Manipuliert', 'off',
        '11111111-1111-1111-1111-111111111111', array['en:beverages']) $$,
  '42501',
  'new row violates row-level security policy for table "products"',
  'Clients koennen keine selbst gelieferten OFF-Tags speichern'
);

select throws_ok(
  $$ insert into public.products
       (barcode, name, source, created_by, off_last_modified_at)
     values
       ('4000000000002', 'Manipuliert', 'off',
        '11111111-1111-1111-1111-111111111111', now()) $$,
  '42501',
  'new row violates row-level security policy for table "products"',
  'Clients koennen keinen selbst gelieferten OFF-Zeitpunkt speichern'
);

-- Crowdsourcing-Ausreisser duerfen nicht in die Kalorienbilanz gelangen.
select tests.as_postgres();
select throws_ok(
  $$ insert into public.products (name, kcal_per_100, created_by)
     values ('Unfug', 3200, '11111111-1111-1111-1111-111111111111') $$,
  '23514',
  null,
  'unplausible Kalorienangaben werden abgewiesen'
);

select throws_ok(
  $$ insert into public.products (name, protein_g_per_100, created_by)
     values ('Unfug', -5, '11111111-1111-1111-1111-111111111111') $$,
  '23514',
  null,
  'negative Naehrwerte werden abgewiesen'
);

select throws_ok(
  $$ insert into public.products (barcode, name, created_by)
     values ('4001234567890', 'Doppelt', '11111111-1111-1111-1111-111111111111') $$,
  '23505',
  null,
  'derselbe Barcode kann nicht zweimal angelegt werden'
);

select * from finish();
rollback;
