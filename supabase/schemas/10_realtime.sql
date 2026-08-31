-- Gewuenschter Endzustand — NICHT von Hand migrieren (#44).
--
-- Realtime-Publication fuer die geteilten Haushaltstabellen.
--
-- Bewusst NUR die gemeinsam live veraenderten Haushaltstabellen. Die privaten
-- Tabellen aus #41 bleiben draussen: Sie werden nie geteilt, und jede
-- zusaetzliche Publication ist unnoetige Last und Angriffsflaeche.
--
-- ACHTUNG: `alter publication ... add table` wird vom Schema-Diff NICHT erfasst
-- (bekannter Caveat, supabase/cli#883). Die Statements hier landen deshalb
-- moeglicherweise nicht in der generierten Migration — `supabase/tests/
-- 09_sync_and_realtime.test.sql` prueft das Ergebnis und schlaegt an, wenn sie
-- fehlen.

-- REPLICA IDENTITY FULL ist Voraussetzung dafuer, dass Realtime RLS auswerten
-- kann: Ohne die vollstaendige alte Zeile kann Supabase nicht entscheiden, wer
-- ein Change-Event sehen darf, und verschickt es im Zweifel an Clients, die die
-- Zeile gar nicht sehen duerften.
alter table public.fridge_items replica identity full;
alter table public.shopping_list_items replica identity full;
alter table public.shopping_category_preferences replica identity full;
alter table public.feedback_tickets replica identity full;
alter table public.feedback_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fridge_items'
  ) then
    alter publication supabase_realtime add table public.fridge_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shopping_list_items'
  ) then
    alter publication supabase_realtime add table public.shopping_list_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shopping_category_preferences'
  ) then
    alter publication supabase_realtime add table public.shopping_category_preferences;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feedback_tickets'
  ) then
    alter publication supabase_realtime add table public.feedback_tickets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feedback_messages'
  ) then
    alter publication supabase_realtime add table public.feedback_messages;
  end if;
end;
$$;
