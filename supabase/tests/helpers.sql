-- Gemeinsame Helfer fuer die pgTAP-Tests.

create extension if not exists pgtap with schema extensions;

-- Das private Testschema wird mit der pgTAP-Transaktion zurueckgerollt.
create schema if not exists tests;

-- Echte auth.users-Zeilen loesen dieselben Trigger wie die App aus.
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

-- Die authentifizierte Rolle gilt nur innerhalb der pgTAP-Transaktion; postgres
-- wuerde RLS umgehen und Tests faelschlich gruen machen.
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
end;
$$;

-- reset role kehrt ohne zusaetzliche Rollenmitgliedschaft zum Session-User zurueck.
create or replace function tests.as_postgres()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', null, true);
end;
$$;

create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', null, true);
end;
$$;

-- PUBLIC braucht Zugriff fuer den Rollenwechsel zurueck; das Schema existiert
-- nur innerhalb der zurueckgerollten Testtransaktion.
grant usage on schema tests to public;
grant execute on all functions in schema tests to public;
