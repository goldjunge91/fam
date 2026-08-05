-- child_profiles: sichtbar im Haushalt, aenderbar nur durch Verwalter oder Admin (#37, #43).

begin;
\ir helpers.sql

select plan(7);

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
values (:'hid', '22222222-2222-2222-2222-222222222222', 'Mia', '2018-04-12');

select is(
  (select count(*)::int from public.child_profiles),
  1,
  'ein Mitglied kann ein Kinder-Profil anlegen'
);

-- --------------------------------------------------- sichtbar im ganzen Haushalt
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select is(
  (select display_name from public.child_profiles),
  'Mia',
  'alle Haushaltsmitglieder sehen das Kinder-Profil — wer kocht, muss wissen fuer wen'
);

-- Die Adminin darf aendern, auch ohne Verwalterin zu sein.
update public.child_profiles set height_cm = 118 where display_name = 'Mia';

select tests.as_postgres();
select is(
  (select height_cm from public.child_profiles),
  118::numeric(5,1),
  'ein Administrator kann Kinder-Profile im Haushalt aendern'
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

-- ------------------------------------- Verwalterwechsel bei Austritt des Elters
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
