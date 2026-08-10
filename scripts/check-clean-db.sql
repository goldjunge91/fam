-- check-clean-db.sql — siehe check-clean-db.sh fuer das Warum.
--
-- Ohne supabase/seed.sql muss jede public-Tabelle direkt nach einem Reset
-- leer sein. query_to_xml/xpath fuehrt dafuer pro Tabelle ein dynamisches
-- `count(*)` aus, ganz ohne PL/pgSQL-Funktion — das Ergebnis ist ein JSON-
-- Objekt {tabelle: anzahl} nur fuer nicht-leere Tabellen, oder NULL.
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
  where n.nspname = 'public' and c.relkind = 'r'
) counts
where cnt > 0;
