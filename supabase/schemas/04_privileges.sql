-- Gewuenschter Endzustand der Zugriffsrechte — NICHT von Hand migrieren.
--
-- Rechte stehen bewusst in einer eigenen Datei und nicht bei den Tabellen:
-- Sie sind die Stelle, an der ein Fehler direkt zu einem Datenleck wird, und
-- gehoeren an einen Ort, den man am Stueck lesen und reviewen kann.
--
-- WICHTIG: Diese Datei funktioniert nur mit der Diff-Engine `pg-delta`.
-- Die aeltere `migra` erfasst weder Schema-Privilegien noch Funktions-Grants
-- noch Kommentare — mit ihr waeren alle Statements hier wirkungslos. Siehe
-- AGENTS.md.

-- ------------------------------------------------------------- Tabellenrechte
-- Supabase vergibt diese Rechte per Default an alle drei Rollen. Hier stehen
-- sie ausdruecklich, damit der Diff sie nicht als "nicht deklariert, also
-- entziehen" liest und die App aussperrt.
--
-- Tabellenrechte sind bewusst grob: Welche ZEILEN jemand sieht, entscheidet
-- ausschliesslich RLS. Ohne das Tabellenrecht kaeme die Policy gar nicht erst
-- zum Zuge, mit dem Recht allein sieht niemand fremde Daten.
grant delete, insert, select, update on public.profiles to anon, authenticated, service_role;
grant delete, insert, select, update on public.households to anon, authenticated, service_role;
grant delete, insert, select, update on public.household_members to anon, authenticated, service_role;
grant delete, insert, select, update on public.products to anon, authenticated, service_role;

-- ------------------------------------------------------------ Schema `private`
-- `authenticated` braucht USAGE, weil die RLS-Policies auf households und
-- household_members die Helfer in diesem Schema aufrufen.
--
-- `anon` bekommt sie ausdruecklich nicht. Alle Policies sind `to authenticated`;
-- ein anonymer Client wertet sie nie aus.
grant usage on schema private to authenticated;

grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_admin(uuid) to authenticated;

-- Postgres vergibt EXECUTE auf neue Funktionen per Default an PUBLIC, und
-- `anon` erbt von PUBLIC. Ohne diesen Entzug haette `anon` das Recht — auch
-- wenn ihm die Schema-USAGE fehlt und der Aufruf daran scheitern wuerde.
-- Zwei Schichten sind hier billiger als die Diskussion, ob eine reicht.
revoke execute on function private.is_household_member(uuid) from public, anon;
revoke execute on function private.is_household_admin(uuid) from public, anon;

-- Trigger-Funktionen ruft niemand direkt auf; sie laufen unter den Rechten des
-- Eigentuemers, wenn der Trigger feuert.
revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.guard_last_admin() from public, anon, authenticated;

-- --------------------------------------------------------------------- public
-- create_household() SOLL vom Client aufrufbar sein — anders als die Helfer.
revoke execute on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
