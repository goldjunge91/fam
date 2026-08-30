-- Gemeinsame Helfer fuer die pgTAP-Tests.
--
-- Wird von jeder Testdatei per \ir eingebunden. Enthaelt bewusst KEINE
-- Assertions, nur Werkzeug.

create extension if not exists pgtap with schema extensions;

-- Testwerkzeug liegt in einem eigenen Schema und nie in `public` — dort waere
-- es ueber die Data API erreichbar. pgTAP kapselt jede Testdatei in eine
-- Transaktion, die am Ende zurueckgerollt wird; das Schema verschwindet also
-- mit dem Testlauf wieder.
create schema if not exists tests;

-- Legt einen echten auth.users-Eintrag an. Kein Testdouble: Der Trigger
-- on_auth_user_created soll dabei genauso feuern wie in der App.
create or replace function tests.create_user(user_id uuid, email text)
returns uuid
language plpgsql
as $$
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
  )
  values (
    user_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', email, 'nicht-verwendet', now(), now()
  );
  return user_id;
end;
$$;

-- Schluepft in die Rolle eines angemeldeten Nutzers.
--
-- Wichtig: wirkt nur innerhalb einer Transaktion. Ausserhalb laeuft alles
-- weiter als `postgres` — und der umgeht RLS, sodass jeder Test faelschlich
-- gruen waere. pgTAP kapselt jede Datei in eine Transaktion, deshalb passt das.
create or replace function tests.authenticate_as(user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

-- Zurueck zu Superuser-Rechten, um Testdaten aufzubauen oder Ergebnisse zu
-- pruefen, die RLS sonst verbergen wuerde.
--
-- `reset role` statt `set role postgres`: Ersteres kehrt immer zum Session-User
-- zurueck und ist ohne Mitgliedschaft erlaubt. `set role postgres` scheitert
-- dagegen mit "permission denied to grant role postgres", weil die Testrolle
-- keine ADMIN-Option darauf hat.
create or replace function tests.as_postgres()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', null, true);
  perform set_config('request.jwt.claim.sub', null, true);
  perform set_config('request.jwt.claim.role', null, true);
end;
$$;

-- Anonymer Client: angemeldet ist niemand.
create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', null, true);
  perform set_config('request.jwt.claim.sub', null, true);
  perform set_config('request.jwt.claim.role', 'anon', true);
end;
$$;

-- Nach `authenticate_as(...)` laeuft die Sitzung als `authenticated` — und
-- diese Rolle haette ohne die folgenden Rechte keinen Zugriff mehr auf das
-- Testwerkzeug selbst ("permission denied for schema tests"). Der Rueckweg zu
-- `as_postgres()` waere damit versperrt.
--
-- Unbedenklich, weil das Schema nur waehrend der Testtransaktion existiert und
-- am Ende zurueckgerollt wird.
grant usage on schema tests to public;
grant execute on all functions in schema tests to public;
