-- Nach einem Reset duerfen nur die unten ausgeschlossenen Seed-Tabellen Daten enthalten.
-- query_to_xml zaehlt dynamisch; das Ergebnis enthaelt nur unerwartet belegte Tabellen.
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
