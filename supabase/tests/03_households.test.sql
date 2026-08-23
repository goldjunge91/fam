-- households + household_members: Rekursionsfreiheit, Isolation, Rollen (#35, #43).

begin;
\ir helpers.sql

select plan(24);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

-- Alice ist Admin, Bob Mitglied und Carol Aussenstehende.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'member');

-- Die SECURITY-DEFINER-Helfer verhindern rekursive Membership-RLS.
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

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

delete from public.household_members
where user_id = '11111111-1111-1111-1111-111111111111';

update public.households set name = 'Umbenannt von Bob'
where id = :'hid';

select tests.as_postgres();
-- Nur den eigenen Testhaushalt zaehlen.
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

-- Das RPC gibt Identitaet, aber keine privaten Gesundheitsdaten frei.
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

-- Der direkte Profilzugriff bleibt trotz RPC geschlossen.
select is_empty(
  $$ select id from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  'der direkte Zugriff auf fremde Profile bleibt gesperrt'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');

select is_empty(
  format($$ select user_id from public.household_member_profiles(%L) $$, :'hid'),
  'Aussenstehende bekommen die Mitgliederliste eines fremden Haushalts nicht'
);

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

-- Der Admin-Guard darf kaskadierende Haushaltsloeschungen nicht blockieren.
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

select tests.as_postgres();
select tests.create_user('66666666-6666-6666-6666-666666666666', 'frank@example.com');
select tests.authenticate_as('66666666-6666-6666-6666-666666666666');
select public.create_household('Solo Frank') as hid_frank \gset

select lives_ok(
  format($$ delete from public.households where id = %L $$, :'hid_frank'),
  'ein alleiniger Admin kann seinen Solo-Haushalt loeschen'
);

-- Das letzte Mitglied muss den danach unerreichbaren Haushalt mitloeschen.
select tests.as_postgres();
select tests.create_user('cccccccc-3333-3333-3333-333333333333', 'liam@example.com');
select tests.authenticate_as('cccccccc-3333-3333-3333-333333333333');
select public.create_household('Solo Liam') as hid_liam \gset

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

-- Beim letzten Admin mit Mitgliedern muss die Vorbereitung atomar abbrechen.
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

-- created_by muss vor der Profil-Loeschung uebertragen werden.
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
