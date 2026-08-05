-- Zusicherungen zu Zugriffsrechten, die der Schema-Diff nicht garantieren kann.
--
-- Hintergrund: `supabase db diff` vergleicht die Schemadateien gegen eine
-- lokale Schatten-Datenbank. Supabase-Remote-Projekte haben aber
-- ALTER-DEFAULT-PRIVILEGES, die `execute` auf neue Funktionen im Schema
-- `public` an `anon` und `authenticated` vergeben — lokal existieren die nicht.
--
-- Ein generiertes `revoke ... from public` entfernt diesen separaten, expliziten
-- Grant nicht. Der Diff ist dafuer blind, weil lokal nichts zu entziehen war.
-- Genau so war `public.create_household(text)` nach dem ersten Push fuer `anon`
-- aufrufbar, obwohl die Schemadatei den Entzug deklarierte.
--
-- Ausfuehren: bash scripts/check-privileges.sh [--linked]
--
-- Bewusst ohne psql-Meta-Befehle wie `\set`: Die Datei laeuft auch ueber
-- `supabase db query --linked`, das reines SQL an die API schickt und
-- Backslash-Befehle nicht kennt. Der Abbruch kommt aus `raise exception`.

do $$
declare
  verstoss text;
  anzahl integer := 0;
begin
  -- 1. Keine SECURITY-DEFINER-Funktion in `public` darf von `anon` aufrufbar
  --    sein. Solche Funktionen umgehen RLS und haengen unter /rest/v1/rpc/.
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

  -- 2. `anon` darf das Schema `private` nicht benutzen duerfen.
  if has_schema_privilege('anon', 'private', 'usage') then
    raise warning 'anon hat USAGE auf Schema private';
    anzahl := anzahl + 1;
  end if;

  -- 3. Die RLS-Helfer duerfen fuer `anon` nicht ausfuehrbar sein.
  if has_function_privilege('anon', 'private.is_household_member(uuid)', 'execute')
     or has_function_privilege('anon', 'private.is_household_admin(uuid)', 'execute') then
    raise warning 'anon kann die RLS-Helfer aufrufen';
    anzahl := anzahl + 1;
  end if;

  -- 4. Gegenprobe: `authenticated` MUSS die Helfer aufrufen koennen, sonst
  --    scheitert jede Query mit "permission denied for function".
  if not has_schema_privilege('authenticated', 'private', 'usage')
     or not has_function_privilege('authenticated', 'private.is_household_member(uuid)', 'execute') then
    raise warning 'authenticated fehlen Rechte auf die RLS-Helfer — Policies wuerden brechen';
    anzahl := anzahl + 1;
  end if;

  -- 5. Jede Tabelle in `public` braucht RLS. Ohne sie ist sie ueber die Data API
  --    vollstaendig lesbar, sobald anon/authenticated Tabellenrechte haben.
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
