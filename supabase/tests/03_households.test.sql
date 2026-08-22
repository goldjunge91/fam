-- households + household_members: Rekursionsfreiheit, Isolation, Rollen (#35, #43).

begin;
\ir helpers.sql

select plan(24);

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

update public.households set name = 'Umbenannt von Bob'
where id = :'hid';

select tests.as_postgres();
-- Auf den Testhaushalt eingegrenzt: Ein globales count(*) waere von Daten
-- abhaengig, die andere Testlaeufe hinterlassen haben.
select is(
  (select count(*)::int from public.household_members
   where household_id = :'hid' and role = 'admin'),
  1,
  'ein Mitglied ohne Adminrolle kann die Adminin nicht entfernen'
);

select is(
  (select name from public.households where id = :'hid'),
  'Familie Tozzi',
  'ein Mitglied ohne Adminrolle kann den Haushaltsnamen nicht ändern'
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

-- --------------------------------------- Haushalt komplett loeschen (#64, #98)
-- Regressionstest fuer einen frueher unentdeckten Bug: `guard_last_admin`
-- feuert auch fuer household_members-Zeilen, die per ON DELETE CASCADE
-- verschwinden, weil der ganze Haushalt geloescht wird — und blockierte damit
-- bislang JEDE Haushaltsloeschung mit mehr als einem Mitglied (der letzte Admin
-- "verliesse" scheinbar einen Haushalt, den es danach gar nicht mehr gibt).
select tests.as_postgres();
select tests.create_user('44444444-4444-4444-4444-444444444444', 'dave@example.com');
select tests.create_user('55555555-5555-5555-5555-555555555555', 'erin@example.com');

select tests.authenticate_as('44444444-4444-4444-4444-444444444444');
select public.create_household('Haushalt Dave') as hid_dave \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid_dave', '55555555-5555-5555-5555-555555555555', 'member');

select tests.authenticate_as('44444444-4444-4444-4444-444444444444');
select lives_ok(
  format($$ delete from public.households where id = %L $$, :'hid_dave'),
  'ein Admin kann seinen Haushalt mit weiteren Mitgliedern vollstaendig loeschen'
);

select tests.as_postgres();
select is(
  (select count(*)::int from public.household_members where household_id = :'hid_dave'),
  0,
  'die Loeschung kaskadiert auf household_members'
);

-- Solo-Haushalt (Admin ist einziges Mitglied) muss ebenfalls loeschbar sein.
select tests.as_postgres();
select tests.create_user('66666666-6666-6666-6666-666666666666', 'frank@example.com');
select tests.authenticate_as('66666666-6666-6666-6666-666666666666');
select public.create_household('Solo Frank') as hid_frank \gset

select lives_ok(
  format($$ delete from public.households where id = %L $$, :'hid_frank'),
  'ein alleiniger Admin kann seinen Solo-Haushalt loeschen'
);

-- --------------------------------- verwaisten Haushalt aufraeumen (#189)
-- Verlaesst das letzte Mitglied einen Haushalt, feuert der AFTER-DELETE-Trigger
-- und loescht die verwaiste households-Zeile. Ohne ihn bliebe sie mitsamt allen
-- geteilten Daten fuer immer stehen — per RLS fuer niemanden mehr erreichbar.
select tests.as_postgres();
select tests.create_user('cccccccc-3333-3333-3333-333333333333', 'liam@example.com');
select tests.authenticate_as('cccccccc-3333-3333-3333-333333333333');
select public.create_household('Solo Liam') as hid_liam \gset

-- Der alleinige Admin verlaesst den Haushalt; die Sperre laesst das zu, weil
-- danach niemand ohne Admin zurueckbliebe.
delete from public.household_members
where user_id = 'cccccccc-3333-3333-3333-333333333333';

select tests.as_postgres();
select is(
  (select count(*)::int from public.households where id = :'hid_liam'),
  0,
  'verlaesst das letzte Mitglied den Haushalt, wird die verwaiste households-Zeile geloescht'
);

select is(
  (select count(*)::int from public.storage_locations where household_id = :'hid_liam'),
  0,
  'die Cascade raeumt die geteilten Daten des verwaisten Haushalts mit ab'
);

-- ------------------------------------------- prepare_account_deletion() (#98)
-- Letzter Admin mit weiteren Mitgliedern: muss abbrechen, nichts darf
-- angewendet werden.
select tests.as_postgres();
select tests.create_user('77777777-7777-7777-7777-777777777777', 'gina@example.com');
select tests.create_user('88888888-8888-8888-8888-888888888888', 'hank@example.com');

select tests.authenticate_as('77777777-7777-7777-7777-777777777777');
select public.create_household('Haushalt Gina') as hid_gina \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid_gina', '88888888-8888-8888-8888-888888888888', 'member');

select tests.authenticate_as('77777777-7777-7777-7777-777777777777');
select throws_like(
  $$ select public.prepare_account_deletion() $$,
  'last_admin_with_members%',
  'prepare_account_deletion bricht ab, wenn andere Mitglieder ohne Admin zurueckblieben'
);

-- Solo-Haushalt: prepare_account_deletion loescht ihn vollstaendig.
select tests.as_postgres();
select tests.create_user('99999999-9999-9999-9999-999999999999', 'ivy@example.com');
select tests.authenticate_as('99999999-9999-9999-9999-999999999999');
select public.create_household('Solo Ivy') as hid_ivy \gset

select lives_ok(
  $$ select public.prepare_account_deletion() $$,
  'prepare_account_deletion laeuft durch, wenn der Nutzer ueberall entweder allein oder nicht letzter Admin ist'
);

select tests.as_postgres();
select is(
  (select count(*)::int from public.households where id = :'hid_ivy'),
  0,
  'prepare_account_deletion loescht einen Solo-Haushalt vollstaendig'
);

-- created_by wird bei einem verbleibenden Haushalt auf ein anderes Mitglied
-- uebertragen, sonst wuerde die anschliessende Profil-Loeschung an
-- `on delete restrict` scheitern.
select tests.as_postgres();
select tests.create_user('aaaaaaaa-1111-1111-1111-111111111111', 'jack@example.com');
select tests.create_user('bbbbbbbb-2222-2222-2222-222222222222', 'kate@example.com');

select tests.authenticate_as('aaaaaaaa-1111-1111-1111-111111111111');
select public.create_household('Haushalt Jack') as hid_jack \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid_jack', 'bbbbbbbb-2222-2222-2222-222222222222', 'admin');

select tests.authenticate_as('aaaaaaaa-1111-1111-1111-111111111111');
select public.prepare_account_deletion();

select tests.as_postgres();
select is(
  (select created_by::text from public.households where id = :'hid_jack'),
  'bbbbbbbb-2222-2222-2222-222222222222',
  'created_by wird auf ein verbleibendes Mitglied uebertragen, der Haushalt bleibt bestehen'
);

select * from finish();
rollback;
