-- households + household_members: Rekursionsfreiheit, Isolation, Rollen (#35, #43).

begin;
\ir helpers.sql

select plan(14);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

-- Alice legt den Haushalt an, Bob wird Mitglied, Carol bleibt draussen.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'member');

-- --------------------------------------------------------- keine Rekursion
-- Ohne die SECURITY-DEFINER-Helfer wuerde diese Query mit
-- "infinite recursion detected in policy for relation household_members"
-- abbrechen: die Policy fragt zur Pruefung einer Zeile wieder dieselbe Tabelle.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$ select count(*) from public.household_members $$,
  'household_members ist abfragbar — keine Policy-Rekursion'
);

select is(
  (select count(*)::int from public.household_members),
  2,
  'Alice sieht beide Mitglieder ihres Haushalts'
);

select is(
  (select role from public.household_members
   where user_id = '11111111-1111-1111-1111-111111111111'),
  'admin',
  'der Ersteller ist automatisch Administrator'
);

select is(
  (select count(*)::int from public.households),
  1,
  'Alice sieht ihren Haushalt'
);

-- ------------------------------------------------------------- Aussenstehende
select tests.authenticate_as('33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.households),
  0,
  'Carol sieht fremde Haushalte nicht'
);

select is(
  (select count(*)::int from public.household_members),
  0,
  'Carol sieht fremde Mitgliederlisten nicht'
);

-- --------------------------------------------------- Mitglied ohne Adminrolle
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

delete from public.household_members
where user_id = '11111111-1111-1111-1111-111111111111';

select tests.as_postgres();
-- Auf den Testhaushalt eingegrenzt: Ein globales count(*) waere von Daten
-- abhaengig, die andere Testlaeufe hinterlassen haben.
select is(
  (select count(*)::int from public.household_members
   where household_id = :'hid' and role = 'admin'),
  1,
  'ein Mitglied ohne Adminrolle kann die Adminin nicht entfernen'
);

-- ------------------------------------------- Mitgliederliste mit Anzeigenamen
-- Mitglieder muessen sehen, WER sonst im Haushalt ist — ohne dass dabei die
-- privaten Gesundheitsdaten aus profiles mitkommen.
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.household_member_profiles(:'hid')),
  2,
  'household_member_profiles listet alle Mitglieder des Haushalts'
);

select is(
  (select display_name from public.household_member_profiles(:'hid')
   where user_id = '11111111-1111-1111-1111-111111111111'),
  'alice',
  'Bob sieht den Anzeigenamen der anderen Mitglieder'
);

-- Die Gegenprobe zum Test darueber: Der direkte Weg bleibt zu. Das RPC ist die
-- einzige Tuer, und sie gibt nur Anzeigename und Avatar heraus.
select is_empty(
  $$ select id from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  'der direkte Zugriff auf fremde Profile bleibt gesperrt'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');

select is_empty(
  format($$ select user_id from public.household_member_profiles(%L) $$, :'hid'),
  'Aussenstehende bekommen die Mitgliederliste eines fremden Haushalts nicht'
);

-- ------------------------------------------------------- letzter Admin bleibt
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ delete from public.household_members
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'P0001',
  'Der letzte Administrator kann den Haushalt nicht verlassen. Ernenne zuerst jemand anderen.',
  'der letzte Administrator kann nicht austreten'
);

select throws_ok(
  $$ update public.household_members set role = 'member'
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'P0001',
  'Der letzte Administrator kann den Haushalt nicht verlassen. Ernenne zuerst jemand anderen.',
  'der letzte Administrator kann sich nicht selbst degradieren'
);

-- Mit einem zweiten Admin ist der Austritt erlaubt.
select tests.as_postgres();
update public.household_members set role = 'admin'
where user_id = '22222222-2222-2222-2222-222222222222';

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
delete from public.household_members
where user_id = '11111111-1111-1111-1111-111111111111';

select tests.as_postgres();
select is(
  (select count(*)::int from public.household_members where household_id = :'hid'),
  1,
  'mit einem zweiten Administrator gelingt der Austritt'
);

select * from finish();
rollback;
