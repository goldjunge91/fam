-- Gewuenschter Endzustand — NICHT von Hand migrieren (#44).
-- Nur gemeinsam bearbeitete Haushaltstabellen werden ueber Realtime publiziert.
-- Schema-Diffs erfassen Publication-Aenderungen nicht (supabase/cli#883).

-- REPLICA IDENTITY FULL liefert Realtime genug Daten fuer die RLS-Auswertung.
alter table public.fridge_items replica identity full;
alter table public.shopping_list_items replica identity full;
alter table public.shopping_category_preferences replica identity full;

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
end;
$$;
