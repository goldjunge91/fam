-- check-clean-db.sql — siehe check-clean-db.sh fuer das Warum.
--
-- supabase/seed.sql seedet feste Referenzdaten (Produkte, Rezeptvorlagen) bei
-- jedem `supabase db reset` — diese Tabellen sind danach nie leer und muessen
-- von der Pruefung ausgenommen werden (Liste unten synchron zu seed.sql
-- halten). Jede andere public-Tabelle muss direkt nach einem Reset leer sein.
-- query_to_xml/xpath fuehrt dafuer pro Tabelle ein dynamisches `count(*)`
-- aus, ganz ohne PL/pgSQL-Funktion — das Ergebnis ist ein JSON-Objekt
-- {tabelle: anzahl} nur fuer nicht-leere, nicht-geseedete Tabellen, oder NULL.
select jsonb_object_agg(tablename, cnt)
from (
  select
    c.relname as tablename,
    (xpath(
      '/row/c/text()',
      query_to_xml(format('select count(*) as c from public.%I', c.relname), false, true, '')
    ))[1]::text::int as cnt
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname not in (
      'products',
      'recipe_templates',
      'recipe_template_items',
      'recipe_template_steps',
      'recipe_template_components'
    )
) counts
where cnt > 0;
