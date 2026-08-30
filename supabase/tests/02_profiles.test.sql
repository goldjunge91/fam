-- profiles: Trigger und private Isolation (#34, #43).

begin;
\ir helpers.sql

select plan(8);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');

-- ------------------------------------------------------------------- Trigger
-- Auf die eigenen Fixtures eingegrenzt statt `count(*)` ueber die ganze
-- Tabelle: Sonst schlaegt der Test fehl, sobald irgendetwas anderes Daten
-- hinterlassen hat (etwa die Integrationstests) — und meldet damit einen
-- Fehler, den es im Code nicht gibt.
select is(
  (select count(*)::int from public.profiles
   where id in (
     '11111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222'
   )),
  2,
  'on_auth_user_created legt fuer jeden neuen auth.users-Eintrag ein Profil an'
);

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'alice',
  'display_name wird aus dem lokalen Teil der E-Mail vorbelegt'
);

-- --------------------------------------------------------------- Isolation
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select is(
  (select count(*)::int from public.profiles),
  1,
  'Alice sieht genau ihr eigenes Profil, nicht beide'
);

select is_empty(
  $$ select id from public.profiles where id = '22222222-2222-2222-2222-222222222222' $$,
  'Alice sieht Bobs Profil nicht'
);

-- Ein UPDATE auf eine nicht sichtbare Zeile trifft 0 Zeilen — Postgres wirft
-- dabei keinen Fehler. Genau deshalb wird hier das Ergebnis geprueft und nicht
-- nur, ob das Statement durchlaeuft.
update public.profiles set display_name = 'gekapert'
where id = '22222222-2222-2222-2222-222222222222';

select tests.as_postgres();

select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'bob',
  'Alices UPDATE auf Bobs Profil blieb wirkungslos'
);

-- ------------------------------------------------------------ eigene Aenderung
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
update public.profiles set display_name = 'Alice T.' where id = '11111111-1111-1111-1111-111111111111';
select tests.as_postgres();

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice T.',
  'Alice kann ihr eigenes Profil aendern'
);

select throws_ok(
  $$ update public.profiles
     set tracking_day_start_time = '24:00'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514',
  null,
  'der Tagesstart muss eine gueltige Uhrzeit im Format HH:MM sein'
);

-- ----------------------------------------------------------------- anonym
select tests.authenticate_as_anon();

select is_empty(
  $$ select id from public.profiles $$,
  'ein anonymer Client sieht keine Profile'
);

select tests.as_postgres();
select * from finish();
rollback;
