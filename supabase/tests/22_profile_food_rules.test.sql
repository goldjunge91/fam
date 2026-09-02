-- Persoenliche Lebensmittelregeln bleiben privat und accountweit.

begin;
\ir helpers.sql

select plan(11);

select has_table(
  'public',
  'profile_food_rules',
  'persoenliche Lebensmittelregeln haben eine eigene private Tabelle'
);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

insert into public.profile_food_rules (
  user_id,
  allergy_codes,
  custom_allergies,
  intolerance_codes,
  custom_intolerances,
  disliked_foods
)
values (
  '11111111-1111-1111-1111-111111111111',
  array['peanuts', 'milk'],
  array['Johannisbrot'],
  array['lactose'],
  array['Histamin'],
  array['Oliven', 'Pilze']
);

select is(
  (select allergy_codes from public.profile_food_rules),
  array['peanuts', 'milk'],
  'Alice kann ihre eigenen Allergien speichern und lesen'
);

select is(
  (select disliked_foods from public.profile_food_rules),
  array['Oliven', 'Pilze'],
  'freie Abneigungen bleiben in ihrer Reihenfolge erhalten'
);

update public.profile_food_rules
set intolerance_codes = array['lactose', 'sorbitol-malabsorption']
where user_id = '11111111-1111-1111-1111-111111111111';

select is(
  (select intolerance_codes from public.profile_food_rules),
  array['lactose', 'sorbitol-malabsorption'],
  'Alice kann ihre eigenen Angaben aendern'
);

select throws_ok(
  $$ insert into public.profile_food_rules (user_id, allergy_codes)
     values ('11111111-1111-1111-1111-111111111111', array['unbekannt']) $$,
  '23514',
  null,
  'unbekannte Allergie-Codes werden abgelehnt'
);

select throws_ok(
  $$ update public.profile_food_rules
     set intolerance_codes = array['unbekannt']
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514',
  null,
  'unbekannte Unvertraeglichkeits-Codes werden abgelehnt'
);

-- Bob ist sogar Administrator desselben Haushalts. Das darf ihm keine
-- Sonderrechte auf Alices private Angaben geben.
select public.create_household('Familie Privat') as hid \gset
select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'admin');
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is_empty(
  $$ select user_id from public.profile_food_rules
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'ein Haushalts-Administrator sieht fremde Lebensmittelregeln nicht'
);

update public.profile_food_rules
set disliked_foods = array['alles']
where user_id = '11111111-1111-1111-1111-111111111111';

select tests.as_postgres();
select is(
  (select disliked_foods from public.profile_food_rules
   where user_id = '11111111-1111-1111-1111-111111111111'),
  array['Oliven', 'Pilze'],
  'ein Haushalts-Administrator kann fremde Angaben nicht aendern'
);

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ insert into public.profile_food_rules (user_id)
     values ('11111111-1111-1111-1111-111111111111') $$,
  '42501',
  'new row violates row-level security policy for table "profile_food_rules"',
  'niemand kann Angaben im Namen eines anderen anlegen'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ delete from public.profile_food_rules
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  'permission denied for table profile_food_rules',
  'Clients loeschen die Profilzeile nicht, sondern leeren ihre Sammlungen'
);

select tests.authenticate_as_anon();
select throws_ok(
  $$ select * from public.profile_food_rules $$,
  '42501',
  'permission denied for table profile_food_rules',
  'anonyme Clients haben keinen Tabellenzugriff'
);

select tests.as_postgres();
select * from finish();
rollback;
