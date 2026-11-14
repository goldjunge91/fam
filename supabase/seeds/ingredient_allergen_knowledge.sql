-- Enger, positiv belegter Startbestand aus Anhang II der Verordnung (EU)
-- Nr. 1169/2011, konsolidierter Stand 02011R1169-20250401.
-- Es werden weder Allergiefreiheit noch Markenprodukte oder Spurenhinweise
-- abgeleitet. Wortvarianten bleiben auf die direkt belegten Begriffe begrenzt.

begin;

create temporary table curated_eu_annex_ii (
  canonical_name text primary key,
  allergen_id text not null,
  annex_point smallint not null,
  aliases text[] not null
) on commit drop;

insert into curated_eu_annex_ii (canonical_name, allergen_id, annex_point, aliases)
values
  ('Weizen', 'EU_01_GLUTEN_CEREALS', 1, array['Weizen', 'Weizenmehl']),
  ('Dinkel', 'EU_01_GLUTEN_CEREALS', 1, array['Dinkel', 'Dinkelmehl']),
  ('Khorasanweizen', 'EU_01_GLUTEN_CEREALS', 1, array['Khorasanweizen', 'Khorasan-Weizen']),
  ('Roggen', 'EU_01_GLUTEN_CEREALS', 1, array['Roggen', 'Roggenmehl']),
  ('Gerste', 'EU_01_GLUTEN_CEREALS', 1, array['Gerste', 'Gerstenmehl']),
  ('Hafer', 'EU_01_GLUTEN_CEREALS', 1, array['Hafer', 'Haferflocken']),
  ('Krebstiere', 'EU_02_CRUSTACEANS', 2, array['Krebstiere', 'Krebstier']),
  ('Eier', 'EU_03_EGGS', 3, array['Eier', 'Ei']),
  ('Fische', 'EU_04_FISH', 4, array['Fische', 'Fisch']),
  ('Erdnüsse', 'EU_05_PEANUTS', 5, array['Erdnüsse', 'Erdnuss']),
  ('Sojabohnen', 'EU_06_SOYBEANS', 6, array['Sojabohnen', 'Sojabohne']),
  ('Milch', 'EU_07_MILK', 7, array['Milch']),
  ('Laktose', 'EU_07_MILK', 7, array['Laktose', 'Lactose']),
  ('Mandeln', 'EU_08_NUTS', 8, array['Mandeln', 'Mandel']),
  ('Haselnüsse', 'EU_08_NUTS', 8, array['Haselnüsse', 'Haselnuss']),
  ('Walnüsse', 'EU_08_NUTS', 8, array['Walnüsse', 'Walnuss']),
  ('Cashewkerne', 'EU_08_NUTS', 8, array['Cashewkerne', 'Cashew']),
  ('Pekannüsse', 'EU_08_NUTS', 8, array['Pekannüsse', 'Pekannuss']),
  ('Paranüsse', 'EU_08_NUTS', 8, array['Paranüsse', 'Paranuss']),
  ('Pistazien', 'EU_08_NUTS', 8, array['Pistazien', 'Pistazie']),
  ('Macadamianüsse', 'EU_08_NUTS', 8, array['Macadamianüsse', 'Macadamianuss']),
  ('Sellerie', 'EU_09_CELERY', 9, array['Sellerie']),
  ('Senf', 'EU_10_MUSTARD', 10, array['Senf', 'Senfsamen', 'Senfkörner']),
  ('Sesamsamen', 'EU_11_SESAME', 11, array['Sesamsamen', 'Sesam']),
  ('Schwefeldioxid', 'EU_12_SULPHITES', 12, array['Schwefeldioxid']),
  ('Sulfite', 'EU_12_SULPHITES', 12, array['Sulfite', 'Sulphite']),
  ('Lupinen', 'EU_13_LUPIN', 13, array['Lupinen', 'Lupine']),
  ('Weichtiere', 'EU_14_MOLLUSCS', 14, array['Weichtiere', 'Weichtier']);

insert into public.food_ingredients (canonical_name)
select canonical_name
from curated_eu_annex_ii
on conflict do nothing;

insert into public.food_ingredient_aliases (
  ingredient_id,
  alias,
  locale,
  source,
  source_id,
  source_url,
  source_version,
  license,
  confidence,
  reviewed_at,
  reviewed_by
)
select
  ingredient.id,
  alias.alias,
  'de',
  'eu_lmiv',
  format(
    'CELEX:02011R1169-20250401#ANNEX-II-%s:term:%s',
    curated.annex_point,
    alias.alias
  ),
  'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:02011R1169-20250401',
  '02011R1169-20250401',
  'EU legislative text; reuse with attribution per 2011/833/EU',
  'verified',
  timestamptz '2026-11-08 00:00:00+00',
  'OpenAI Codex; EUR-Lex source cross-check'
from curated_eu_annex_ii curated
join public.food_ingredients ingredient
  on ingredient.canonical_name = curated.canonical_name
cross join lateral unnest(curated.aliases) as alias(alias)
where not exists (
  select 1
  from public.food_ingredient_aliases existing
  where existing.ingredient_id = ingredient.id
    and lower(trim(existing.alias)) = lower(trim(alias.alias))
    and existing.locale = 'de'
    and existing.source = 'eu_lmiv'
    and existing.source_id = format(
      'CELEX:02011R1169-20250401#ANNEX-II-%s:term:%s',
      curated.annex_point,
      alias.alias
    )
    and existing.source_version = '02011R1169-20250401'
);

insert into public.ingredient_allergen_assessments (
  ingredient_id,
  ingredient_revision,
  allergen_id,
  assessment,
  source,
  source_id,
  source_url,
  source_version,
  license,
  review_scope,
  evidence_snapshot,
  confidence,
  reviewed_at,
  reviewed_by
)
select
  ingredient.id,
  ingredient.revision,
  curated.allergen_id,
  'contains',
  'eu_lmiv',
  format(
    'CELEX:02011R1169-20250401#ANNEX-II-%s:ingredient:%s',
    curated.annex_point,
    curated.canonical_name
  ),
  'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:02011R1169-20250401',
  '02011R1169-20250401',
  'EU legislative text; reuse with attribution per 2011/833/EU',
  case curated.annex_point
    when 1 then 'Direkt benanntes glutenhaltiges Grundgetreide; Ausnahmen und weitere Verarbeitungsprodukte sind nicht einzeln abgebildet.'
    when 4 then 'Direkt benannte Fischgrundzutat; die gesetzlichen Ausnahmen fuer bestimmte Fischgelatine-Anwendungen sind nicht abgebildet.'
    when 6 then 'Direkt benannte Sojagrundzutat; die gesetzlichen Ausnahmen fuer bestimmte raffinierte oder abgeleitete Stoffe sind nicht abgebildet.'
    when 7 then 'Direkt benannte Milch- oder Laktosegrundzutat; die gesetzlichen Ausnahmen sind nicht einzeln abgebildet.'
    when 8 then 'Direkt benannte Schalenfruchtart; die Ausnahme fuer Nuesse in alkoholischen Destillaten ist nicht abgebildet.'
    when 10 then 'Direkt benannte Senfgrundzutat; die eng begrenzte Behensäure-Ausnahme fuer E 470a, E 471 und E 477 ist nicht abgebildet.'
    when 12 then 'Stoffidentitaet aus Punkt 12; Konzentration und die Schwelle von mehr als 10 mg/kg oder 10 mg/l Gesamt-SO2 sind nicht geprueft.'
    else format('Direkt benannte Grundzutat aus Anhang II Punkt %s; weitere Verarbeitungsprodukte sind nicht einzeln abgebildet.', curated.annex_point)
  end,
  format(
    'Quellenabgleich: kanonische Zutat %s ist in der Stoffgruppe aus Anhang II Punkt %s enthalten.',
    curated.canonical_name,
    curated.annex_point
  ),
  'verified',
  timestamptz '2026-11-08 00:00:00+00',
  'OpenAI Codex; EUR-Lex source cross-check'
from curated_eu_annex_ii curated
join public.food_ingredients ingredient
  on ingredient.canonical_name = curated.canonical_name
where not exists (
  select 1
  from public.ingredient_allergen_assessments existing
  where existing.ingredient_id = ingredient.id
    and existing.allergen_id = curated.allergen_id
    and existing.source = 'eu_lmiv'
    and existing.source_id = format(
      'CELEX:02011R1169-20250401#ANNEX-II-%s:ingredient:%s',
      curated.annex_point,
      curated.canonical_name
    )
    and existing.source_version = '02011R1169-20250401'
);

commit;
