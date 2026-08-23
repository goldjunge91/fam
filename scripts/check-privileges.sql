-- Remote-Default-Privileges koennen anon EXECUTE geben, ohne dass lokale Diffs es sehen.
-- Reines SQL haelt die Pruefung mit `supabase db query --linked` kompatibel.

do $$
declare
  verstoss text;
  anzahl integer := 0;
begin
  -- SECURITY-DEFINER-RPCs duerfen fuer anon nicht ausfuehrbar sein.
  for verstoss in
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    raise warning 'anon kann SECURITY-DEFINER-Funktion aufrufen: public.%', verstoss;
    anzahl := anzahl + 1;
  end loop;

  -- anon darf das private Schema nicht benutzen.
  if has_schema_privilege('anon', 'private', 'usage') then
    raise warning 'anon hat USAGE auf Schema private';
    anzahl := anzahl + 1;
  end if;

  -- anon darf RLS-Helfer nicht ausfuehren.
  if has_function_privilege('anon', 'private.is_household_member(uuid)', 'execute')
     or has_function_privilege('anon', 'private.is_household_admin(uuid)', 'execute') then
    raise warning 'anon kann die RLS-Helfer aufrufen';
    anzahl := anzahl + 1;
  end if;

  -- authenticated braucht die Helfer fuer jede Membership-Policy.
  if not has_schema_privilege('authenticated', 'private', 'usage')
     or not has_function_privilege('authenticated', 'private.is_household_member(uuid)', 'execute') then
    raise warning 'authenticated fehlen Rechte auf die RLS-Helfer — Policies wuerden brechen';
    anzahl := anzahl + 1;
  end if;

  -- Jede public-Tabelle braucht RLS gegen Data-API-Zugriff.
  for verstoss in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    raise warning 'Tabelle ohne RLS: public.%', verstoss;
    anzahl := anzahl + 1;
  end loop;

  if anzahl > 0 then
    raise exception '% Rechte-Verstoesse gefunden', anzahl;
  end if;

  raise notice 'Rechte-Zusicherungen erfuellt';
end;
$$;
