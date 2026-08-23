-- Medizinische und Trainingsdaten muessen selbst vor Admins desselben Haushalts privat bleiben.

begin;
\ir helpers.sql

select plan(16);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'admin');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

insert into public.medication_logs (user_id, medication_name, dose, unit)
values ('11111111-1111-1111-1111-111111111111', 'Semaglutid', 0.5, 'mg');

insert into public.symptom_logs (user_id, appetite_level, satiety_level, nausea_level)
values ('11111111-1111-1111-1111-111111111111', 2, 4, 1);

insert into public.fasting_sessions (user_id, protocol, target_duration_minutes)
values ('11111111-1111-1111-1111-111111111111', '16:8', 960);

insert into public.glucose_entries (user_id, glucose_value, unit, context)
values ('11111111-1111-1111-1111-111111111111', 95.0, 'mg_dl', 'fasting');

insert into public.ketone_entries (user_id, ketone_value, unit, source)
values ('11111111-1111-1111-1111-111111111111', 1.2, 'mmol_l', 'blood');

insert into public.exercises (user_id, name, category, muscle_group, is_custom)
values ('11111111-1111-1111-1111-111111111111', 'Bankdruecken', 'strength', 'chest', true)
returning id as eid \gset

insert into public.workout_sessions (user_id, name)
values ('11111111-1111-1111-1111-111111111111', 'Oberkoerper A')
returning id as wid \gset

insert into public.workout_sets (workout_session_id, exercise_id, set_order, weight_kg, reps)
values (:'wid', :'eid', 1, 60.0, 10);

select is((select count(*)::int from public.medication_logs), 1, 'Alice sieht ihren Medication-Log');
select is((select count(*)::int from public.symptom_logs), 1, 'Alice sieht ihren Symptom-Log');
select is((select count(*)::int from public.fasting_sessions), 1, 'Alice sieht ihre Fasten-Session');
select is((select count(*)::int from public.glucose_entries), 1, 'Alice sieht ihren Glukose-Eintrag');
select is((select count(*)::int from public.ketone_entries), 1, 'Alice sieht ihren Keton-Eintrag');
select is((select count(*)::int from public.workout_sessions), 1, 'Alice sieht ihre Workout-Session');
select is((select count(*)::int from public.workout_sets), 1, 'Alice sieht ihre Workout-Sets');
select is((select count(*)::int from public.exercises where user_id = '11111111-1111-1111-1111-111111111111'), 1, 'Alice sieht ihre eigene Uebung');

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is((select count(*)::int from public.medication_logs), 0, 'Admin Bob sieht Medication-Logs von Alice NICHT');
select is((select count(*)::int from public.symptom_logs), 0, 'Admin Bob sieht Symptom-Logs von Alice NICHT');
select is((select count(*)::int from public.fasting_sessions), 0, 'Admin Bob sieht Fasten-Sessions von Alice NICHT');
select is((select count(*)::int from public.glucose_entries), 0, 'Admin Bob sieht Glukose-Werte von Alice NICHT');
select is((select count(*)::int from public.ketone_entries), 0, 'Admin Bob sieht Keton-Werte von Alice NICHT');
select is((select count(*)::int from public.workout_sessions), 0, 'Admin Bob sieht Workout-Sessions von Alice NICHT');
select is((select count(*)::int from public.workout_sets), 0, 'Admin Bob sieht Workout-Sets von Alice NICHT');
select is((select count(*)::int from public.exercises where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'Admin Bob sieht Custom-Uebungen von Alice NICHT');

rollback;
