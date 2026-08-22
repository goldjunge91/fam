-- Kind-Zuordnung auf Tracking-Tabellen (#190).
--
-- child_profile_id ist ein optionales Zusatz-Tag auf den privaten Tracking-
-- Tabellen. Der FK garantiert nur, DASS ein Kinder-Profil existiert. Ohne
-- weitere Pruefung koennte ein Client einen Eintrag mit einem Kind aus einem
-- FREMDEN Haushalt taggen, denn die RLS-Policies pruefen nur auth.uid() =
-- user_id. Ein Trigger (private.check_tracking_child_household) schliesst diese
-- Luecke: ein gesetztes child_profile_id muss zu einem Haushalt gehoeren, in
-- dem user_id Mitglied ist.
--
-- Aufbau: Alice und Bob sind in GETRENNTEN Haushalten. Alice darf ihren
-- Tracking-Eintrag nicht mit Bobs Kind taggen.

begin;
\ir helpers.sql

select plan(8);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');

-- Alice legt ihren Haushalt an und darin ein Kinder-Profil.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Haushalt Alice') as hid_a \gset
insert into public.child_profiles (household_id, managed_by, display_name)
values (:'hid_a', '11111111-1111-1111-1111-111111111111', 'Mia')
returning id as child_a \gset

-- Bob legt einen getrennten Haushalt mit eigenem Kinder-Profil an.
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select public.create_household('Haushalt Bob') as hid_b \gset
insert into public.child_profiles (household_id, managed_by, display_name)
values (:'hid_b', '22222222-2222-2222-2222-222222222222', 'Tom')
returning id as child_b \gset

-- ------------------------------------------------------- Alice: erlaubte Faelle
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select lives_ok(
  format(
    $$ insert into public.food_entries (user_id, meal_type, quantity, unit, name, child_profile_id)
       values ('11111111-1111-1111-1111-111111111111', 'breakfast', 80, 'g', 'Haferflocken', %L) $$,
    :'child_a'
  ),
  'Alice darf einen Eintrag mit ihrem eigenen Haushaltskind taggen'
);

select lives_ok(
  $$ insert into public.food_entries (user_id, meal_type, quantity, unit, name)
     values ('11111111-1111-1111-1111-111111111111', 'lunch', 120, 'g', 'Reis') $$,
  'Alice darf einen Eintrag ohne child_profile_id (fuer sich selbst) anlegen'
);

select lives_ok(
  format(
    $$ insert into public.weight_entries (user_id, weight_kg, child_profile_id)
       values ('11111111-1111-1111-1111-111111111111', 22.5, %L) $$,
    :'child_a'
  ),
  'die Pruefung greift auch auf weight_entries'
);

-- --------------------------------------------------- Alice: fremdes Kind sperren
select throws_ok(
  format(
    $$ insert into public.food_entries (user_id, meal_type, quantity, unit, name, child_profile_id)
       values ('11111111-1111-1111-1111-111111111111', 'dinner', 80, 'g', 'Nudeln', %L) $$,
    :'child_b'
  ),
  '23514',
  null,
  'Alice kann keinen Eintrag mit Bobs Kind aus einem fremden Haushalt taggen'
);

-- Auch der Umweg ueber ein Update ist versperrt.
select throws_ok(
  format(
    $$ update public.food_entries set child_profile_id = %L
       where user_id = '11111111-1111-1111-1111-111111111111'
         and child_profile_id is null $$,
    :'child_b'
  ),
  '23514',
  null,
  'ein Update auf ein fremdes Kind wird ebenso abgewiesen'
);

-- Der gemeinsame Trigger deckt alle Tracking-Tabellen ab (Stichproben).
select throws_ok(
  format(
    $$ insert into public.medication_logs (user_id, medication_name, child_profile_id)
       values ('11111111-1111-1111-1111-111111111111', 'Ibuprofen', %L) $$,
    :'child_b'
  ),
  '23514',
  null,
  'medication_logs weist ein fremdes Kind ab'
);

select throws_ok(
  format(
    $$ insert into public.workout_sessions (user_id, name, child_profile_id)
       values ('11111111-1111-1111-1111-111111111111', 'Oberkoerper A', %L) $$,
    :'child_b'
  ),
  '23514',
  null,
  'workout_sessions weist ein fremdes Kind ab'
);

-- ------------------------------------- Zugehoerigkeit, nicht Verwalterschaft
-- Bob tritt Alices Haushalt bei. Er darf dann Mias Eintraege taggen, obwohl er
-- das Profil nicht verwaltet — die Pruefung fragt Haushaltszugehoerigkeit ab.
select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid_a', '22222222-2222-2222-2222-222222222222', 'member');

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select lives_ok(
  format(
    $$ insert into public.food_entries (user_id, meal_type, quantity, unit, name, child_profile_id)
       values ('22222222-2222-2222-2222-222222222222', 'snack', 30, 'g', 'Apfel', %L) $$,
    :'child_a'
  ),
  'jedes Haushaltsmitglied darf ein Haushaltskind taggen, nicht nur der Verwalter'
);

select * from finish();
rollback;
