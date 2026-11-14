-- Lebensmittelregeln von Kinderprofilen bleiben auf Verwalter und Haushaltsadmins begrenzt.

begin;
\ir helpers.sql

select plan(17);

select has_table(
  'public',
  'child_profile_food_rules',
  'Kinderprofile haben eine eigene Tabelle fuer private Lebensmittelregeln'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.child_profile_food_rules'::regclass),
  'child_profile_food_rules hat RLS aktiviert'
);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');
select tests.create_user('44444444-4444-4444-4444-444444444444', 'dave@example.com');

-- Alice erstellt den Haushalt als Adminin; Bob verwaltet das Kinderprofil,
-- Carol ist nur Mitglied und Dave bleibt ausserhalb des Haushalts.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Privat') as hid \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values
  (:'hid', '22222222-2222-2222-2222-222222222222', 'member'),
  (:'hid', '33333333-3333-3333-3333-333333333333', 'member');

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
insert into public.child_profiles (household_id, managed_by, display_name, birth_date)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'Mia', '2018-04-12')
returning id as child_id \gset

insert into public.child_profile_food_rules (
  child_profile_id,
  allergy_codes,
  custom_allergies,
  intolerance_codes,
  custom_intolerances,
  disliked_foods
)
values (
  :'child_id',
  array['peanuts', 'milk'],
  array['Johannisbrot'],
  array['lactose'],
  array['Histamin'],
  array['Brokkoli']
);

select is(
  (select allergy_codes from public.child_profile_food_rules where child_profile_id = :'child_id'),
  array['peanuts', 'milk'],
  'der Verwalter kann die Lebensmittelregeln lesen'
);

update public.child_profile_food_rules
set disliked_foods = array['Pilze']
where child_profile_id = :'child_id';

select is(
  (select disliked_foods from public.child_profile_food_rules where child_profile_id = :'child_id'),
  array['Pilze'],
  'der Verwalter kann die Lebensmittelregeln aendern'
);

select throws_ok(
  format(
    $$ update public.child_profile_food_rules
       set allergy_codes = array['unbekannt']
       where child_profile_id = %L::uuid $$,
    :'child_id'
  ),
  '23514',
  null,
  'unbekannte Allergie-Codes werden abgelehnt'
);

select throws_ok(
  format(
    $$ update public.child_profile_food_rules
       set intolerance_codes = array['unbekannt']
       where child_profile_id = %L::uuid $$,
    :'child_id'
  ),
  '23514',
  null,
  'unbekannte Unvertraeglichkeits-Codes werden abgelehnt'
);

select throws_ok(
  format(
    $$ update public.child_profile_food_rules
       set disliked_foods = array_fill('zu-viel'::text, array[65])
       where child_profile_id = %L::uuid $$,
    :'child_id'
  ),
  '23514',
  null,
  'freie Lebensmittelregeln bleiben mengenmaessig begrenzt'
);

select throws_ok(
  format(
    $$ delete from public.child_profile_food_rules where child_profile_id = %L::uuid $$,
    :'child_id'
  ),
  '42501',
  'permission denied for table child_profile_food_rules',
  'Clients loeschen die Regelzeile nicht direkt'
);

-- Ein normales Haushaltsmitglied sieht und aendert die privaten Regeln nicht.
select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select is_empty(
  format(
    $$ select child_profile_id from public.child_profile_food_rules
       where child_profile_id = %L::uuid $$,
    :'child_id'
  ),
  'ein normales Haushaltsmitglied sieht die privaten Regeln nicht'
);

update public.child_profile_food_rules
set disliked_foods = array['gekapert']
where child_profile_id = :'child_id';

select tests.as_postgres();
select is(
  (select disliked_foods from public.child_profile_food_rules where child_profile_id = :'child_id'),
  array['Pilze'],
  'ein normales Haushaltsmitglied kann die privaten Regeln nicht aendern'
);

-- Die Haushaltsadminin darf das verwaltete Kinderprofil betreuen.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::integer from public.child_profile_food_rules
   where child_profile_id = :'child_id'),
  1,
  'ein Haushaltsadmin kann die privaten Regeln lesen'
);

update public.child_profile_food_rules
set disliked_foods = array['Oliven']
where child_profile_id = :'child_id';

select tests.as_postgres();
select is(
  (select disliked_foods from public.child_profile_food_rules where child_profile_id = :'child_id'),
  array['Oliven'],
  'ein Haushaltsadmin kann die privaten Regeln aendern'
);

-- Eine Person ausserhalb des Haushalts bleibt vollstaendig ausgeschlossen.
select tests.authenticate_as('44444444-4444-4444-4444-444444444444');
select is_empty(
  format(
    $$ select child_profile_id from public.child_profile_food_rules
       where child_profile_id = %L::uuid $$,
    :'child_id'
  ),
  'Aussenstehende sehen die privaten Regeln nicht'
);

update public.child_profile_food_rules
set disliked_foods = array['von-aussen']
where child_profile_id = :'child_id';

select tests.as_postgres();
select is(
  (select disliked_foods from public.child_profile_food_rules where child_profile_id = :'child_id'),
  array['Oliven'],
  'Aussenstehende koennen die privaten Regeln nicht aendern'
);

-- Der Verwalter verliert den Zugriff unmittelbar mit dem Haushaltsaustritt.
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
delete from public.household_members
where household_id = :'hid'
  and user_id = '22222222-2222-2222-2222-222222222222';

select is_empty(
  format(
    $$ select child_profile_id from public.child_profile_food_rules
       where child_profile_id = %L::uuid $$,
    :'child_id'
  ),
  'ein ehemaliger Verwalter sieht die privaten Regeln nicht mehr'
);

update public.child_profile_food_rules
set disliked_foods = array['nach-austritt']
where child_profile_id = :'child_id';

select tests.as_postgres();
select is(
  (select disliked_foods from public.child_profile_food_rules where child_profile_id = :'child_id'),
  array['Oliven'],
  'ein ehemaliger Verwalter kann die privaten Regeln nicht mehr aendern'
);

select tests.authenticate_as_anon();
select throws_ok(
  $$ select * from public.child_profile_food_rules $$,
  '42501',
  'permission denied for table child_profile_food_rules',
  'anonyme Clients haben keinen Tabellenzugriff'
);

select tests.as_postgres();
select * from finish();
rollback;
