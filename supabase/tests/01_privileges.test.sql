-- Zugriffsrechte, die der Schema-Diff nicht garantieren kann (#43).
--
-- Diese Zusicherungen sind der Grund, warum es die Datei gibt: Supabase-Remote-
-- Projekte vergeben ueber ALTER DEFAULT PRIVILEGES automatisch EXECUTE auf neue
-- public-Funktionen an `anon`. Lokal existieren diese Defaults nicht, deshalb
-- ist der generierte Diff dafuer blind. Genau so war create_household() nach dem
-- ersten Push fuer anon aufrufbar, obwohl die Schemadatei den Entzug deklarierte.
--
-- Mit `supabase test db --linked` laufen diese Tests auch gegen das echte
-- Projekt und faenden das dort.

begin;
\ir helpers.sql

select plan(12);

-- ------------------------------------------------------ Tabellen brauchen RLS
select is_empty(
  $$ select c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'jede Tabelle in public hat RLS aktiviert'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles hat RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.households'::regclass),
  'households hat RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.household_members'::regclass),
  'household_members hat RLS'
);

-- ----------------------------------- anon kommt an keine SECURITY-DEFINER-Fkt.
select is_empty(
  $$ select p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and has_function_privilege('anon', p.oid, 'execute') $$,
  'keine SECURITY-DEFINER-Funktion in public ist fuer anon aufrufbar'
);

select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon hat keine USAGE auf das Schema private'
);

select ok(
  not has_function_privilege('anon', 'private.is_household_member(uuid)', 'execute'),
  'anon kann is_household_member nicht aufrufen'
);

select ok(
  not has_function_privilege('anon', 'private.is_household_admin(uuid)', 'execute'),
  'anon kann is_household_admin nicht aufrufen'
);

-- Black-Box Direktausführung als anon: Muss mit Permission Denied fehlschlagen
select tests.authenticate_as_anon();
select throws_ok(
  $$ select private.is_household_member('00000000-0000-0000-0000-000000000000'::uuid) $$,
  '42501',
  NULL,
  'anon wird beim direkten Aufruf von private.is_household_member per SQLSTATE 42501 abgeblockt'
);

-- Zurueck zu einer Rolle mit USAGE auf `private`: die folgenden Checks
-- muessen `private.is_household_member(uuid)` zu einem regprocedure
-- aufloesen koennen, was als `anon` schon am fehlenden Schema-USAGE
-- scheitert (SQLSTATE 42501, aber "permission denied for schema private"
-- statt eines von throws_ok gefangenen Funktionsaufrufs).
select tests.as_postgres();

-- ------------------------------------------------------------- Gegenprobe
-- Ohne diese Rechte scheitert JEDE Query mit
-- "permission denied for function is_household_member". Der Test verhindert,
-- dass jemand beim Haerten zu weit geht.
select ok(
  has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated hat USAGE auf private (sonst brechen alle Policies)'
);

select ok(
  has_function_privilege('authenticated', 'private.is_household_member(uuid)', 'execute'),
  'authenticated kann is_household_member aufrufen'
);

-- ---------------------------------------------------------- RPCs fuer Clients
select ok(
  has_function_privilege('authenticated', 'public.create_household(text)', 'execute'),
  'authenticated kann create_household aufrufen'
);

select * from finish();
rollback;
