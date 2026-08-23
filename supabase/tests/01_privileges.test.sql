-- Remote-Defaults koennen anon EXECUTE geben, ohne dass lokale Diffs es sehen.
-- Diese Tests sind deshalb auch fuer verlinkte Projekte relevant.

begin;
\ir helpers.sql

select plan(15);

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

select tests.authenticate_as_anon();
select throws_ok(
  $$ select private.is_household_member('00000000-0000-0000-0000-000000000000'::uuid) $$,
  '42501',
  NULL,
  'anon wird beim direkten Aufruf von private.is_household_member per SQLSTATE 42501 abgeblockt'
);

-- Funktionsauflösung braucht wieder eine Rolle mit private-USAGE.
select tests.as_postgres();

-- Authenticated braucht EXECUTE, damit RLS die Helfer auswerten kann.
select ok(
  has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated hat USAGE auf private (sonst brechen alle Policies)'
);

select ok(
  has_function_privilege('authenticated', 'private.is_household_member(uuid)', 'execute'),
  'authenticated kann is_household_member aufrufen'
);

select ok(
  has_function_privilege('authenticated', 'public.create_household(text)', 'execute'),
  'authenticated kann create_household aufrufen'
);

-- Haushalts-Admins duerfen Premium-Spalten trotz Zeilen-UPDATE nicht aendern.
select ok(
  not has_column_privilege('authenticated', 'public.households', 'premium_active', 'update'),
  'authenticated kann premium_active nicht per UPDATE aendern'
);
select ok(
  not has_column_privilege('authenticated', 'public.households', 'premium_expires_at', 'update'),
  'authenticated kann premium_expires_at nicht per UPDATE aendern'
);
select ok(
  has_column_privilege('authenticated', 'public.households', 'name', 'update'),
  'authenticated kann name weiterhin per UPDATE aendern (Gegenprobe)'
);

select * from finish();
rollback;
