-- child_profiles: sichtbar im Haushalt, aenderbar nur durch Verwalter oder Admin (#37, #43).

begin;
\ir helpers.sql

select plan(11);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

-- Alice ist Adminin, Bob Mitglied, Carol aussen vor.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'member');

-- Bob legt ein Kinder-Profil an und verwaltet es.
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
insert into public.child_profiles (household_id, managed_by, display_name, birth_date)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'Mia', '2018-04-12')
returning id as mia_id \gset

insert into public.child_profiles (household_id, managed_by, display_name, birth_date)
values
  (:'hid', '22222222-2222-2222-2222-222222222222', 'Noah', '2019-05-13'),
  (:'hid', '22222222-2222-2222-2222-222222222222', 'Luca', '2020-06-14');

select tests.as_postgres();
insert into public.food_entries (
  user_id, child_profile_id, logged_on, meal_type, quantity, unit, name, kcal
)
values (
  '22222222-2222-2222-2222-222222222222', :'mia_id', '2026-10-01',
  'lunch', 1, 'portion', 'Mittagessen', 420
);

select is(
  (select count(*)::int from public.child_profiles where id = :'mia_id'),
  1,
  'ein Mitglied kann ein Kinder-Profil anlegen'
);

-- --------------------------------------------------- sichtbar im ganzen Haushalt
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select is(
  (select display_name from public.child_profiles where id = :'mia_id'),
  'Mia',
  'alle Haushaltsmitglieder sehen das Kinder-Profil — wer kocht, muss wissen fuer wen'
);

-- Die Adminin darf aendern, auch ohne Verwalterin zu sein.
update public.child_profiles set height_cm = 118 where id = :'mia_id';

select tests.as_postgres();
select is(
  (select height_cm from public.child_profiles where id = :'mia_id'),
  118::numeric(5,1),
  'ein Administrator kann Kinder-Profile im Haushalt aendern'
);

-- Ein aktueller Verwalter kann sein eigenes Profil loeschen.
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
delete from public.child_profiles where display_name = 'Noah';

select tests.as_postgres();
select is(
  (select count(*)::int from public.child_profiles where display_name = 'Noah'),
  0,
  'ein aktueller Verwalter kann ein verwaltetes Kinder-Profil loeschen'
);

-- Ein aktueller Admin darf ebenfalls loeschen.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
delete from public.child_profiles where display_name = 'Luca';

select tests.as_postgres();
select is(
  (select count(*)::int from public.child_profiles where display_name = 'Luca'),
  0,
  'ein aktueller Admin kann ein Kinder-Profil loeschen'
);

-- ------------------------------------------------------------- Aussenstehende
select tests.authenticate_as('33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.child_profiles),
  0,
  'Aussenstehende sehen keine Kinder-Profile'
);

update public.child_profiles set display_name = 'gekapert';

select tests.as_postgres();
select is(
  (select display_name from public.child_profiles),
  'Mia',
  'Aussenstehende koennen Kinder-Profile nicht aendern'
);

-- -------------------------------------- ehemaliger Verwalter nach Haushaltsaustritt
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
delete from public.household_members
where household_id = :'hid'
  and user_id = '22222222-2222-2222-2222-222222222222';

-- Kein WHERE und kein RETURNING: RLS muss den ehemaligen Verwalter vollstaendig
-- ausschliessen, auch wenn managed_by noch auf sein Profil zeigt.
delete from public.child_profiles;

select tests.as_postgres();
select is(
  (select count(*)::int from public.child_profiles where id = :'mia_id'),
  1,
  'ein ehemaliger Verwalter kann das Kinder-Profil nach Austritt nicht loeschen'
);

select is(
  (select count(*)::int from public.food_entries where child_profile_id = :'mia_id'),
  1,
  'Trackingdaten bleiben nach der abgewiesenen Loeschung erhalten'
);

-- -------------------------------------- Verwalterwechsel bei Austritt des Elters
-- `on delete set null` statt cascade: Verlaesst Bob den Haushalt, bleibt Mias
-- Profil bestehen. Sonst waere mit dem Elternteil auch die Ernaehrungshistorie
-- des Kindes weg.
delete from public.profiles where id = '22222222-2222-2222-2222-222222222222';

select is(
  (select count(*)::int from public.child_profiles),
  1,
  'das Kinder-Profil ueberlebt das Loeschen des verwaltenden Elternteils'
);

select is(
  (select managed_by from public.child_profiles),
  null,
  'managed_by faellt auf NULL zurueck statt das Profil mitzureissen'
);

select * from finish();
rollback;
