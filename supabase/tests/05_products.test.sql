-- products: global lesbar, aber nur eigene manuelle Eintraege aenderbar (#38, #43).

begin;
\ir helpers.sql

select plan(7);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');

insert into public.products (barcode, name, kcal_per_100, source, created_by)
values
  ('4001234567890', 'Haferflocken', 372, 'off', '11111111-1111-1111-1111-111111111111'),
  (null, 'Apfel vom Markt', 52, 'manual', '11111111-1111-1111-1111-111111111111');

-- ------------------------------------------------------------ global lesbar
-- Anders als alles andere im Schema: Produktdaten sind nicht personenbezogen.
-- Zaehlt gezielt Alices Produkte, nicht die ganze Tabelle — seit den
-- Rezeptvorlagen (#Recipe-Templates) enthaelt products auch admin-seed-bare
-- Grundzutaten (supabase/seed.sql), die Tabelle ist also nie leer.
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.products where created_by = '11111111-1111-1111-1111-111111111111'),
  2,
  'Bob sieht auch Produkte, die Alice angelegt hat'
);

-- ------------------------------------------------------- fremde unveraenderbar
update public.products set name = 'gekapert' where barcode = '4001234567890';
update public.products set name = 'gekapert' where created_by = '11111111-1111-1111-1111-111111111111' and source = 'manual';

select tests.as_postgres();
select is_empty(
  $$ select id from public.products where name = 'gekapert' $$,
  'Bob kann fremde Produkte nicht aendern — weder importierte noch manuelle'
);

-- ------------------------------------------------ eigenes manuelles aenderbar
-- Scoped auf Alices eigene Zeile (created_by), nicht auf source = 'manual'
-- allein — davon gibt es seit den Seed-Grundzutaten jetzt viele.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
update public.products set name = 'Apfel, korrigiert'
  where created_by = '11111111-1111-1111-1111-111111111111' and source = 'manual';

select tests.as_postgres();
select is(
  (select name from public.products where created_by = '11111111-1111-1111-1111-111111111111' and source = 'manual'),
  'Apfel, korrigiert',
  'Alice kann ihr eigenes manuelles Produkt korrigieren'
);

-- ------------------------------------------- eigenes importiertes NICHT aenderbar
-- Ein aus Open Food Facts importierter Datensatz wird von allen Haushalten
-- geteilt und darf nicht von einem einzelnen Nutzer veraendert werden — auch
-- nicht von dem, der den Import ausgeloest hat.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
update public.products set name = 'OFF veraendert' where barcode = '4001234567890';

select tests.as_postgres();
select is(
  (select name from public.products where barcode = '4001234567890'),
  'Haferflocken',
  'auch der Anleger kann ein importiertes Produkt nicht aendern'
);

-- ------------------------------------------------------ Plausibilitaetsgrenzen
-- Open Food Facts ist crowdsourced. Werte wie 3200 kcal/100 g kommen dort real
-- vor und landeten ohne Schranke in der Kalorienbilanz des Nutzers.
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

-- ----------------------------------------------------------- Barcode eindeutig
select throws_ok(
  $$ insert into public.products (barcode, name, created_by)
     values ('4001234567890', 'Doppelt', '11111111-1111-1111-1111-111111111111') $$,
  '23505',
  null,
  'derselbe Barcode kann nicht zweimal angelegt werden'
);

select * from finish();
rollback;
