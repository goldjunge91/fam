-- Erweiterte Waivy-Metadaten im globalen Rezeptkatalog.

begin;
\ir helpers.sql

select plan(12);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.as_postgres();

insert into public.catalog_recipes (
  id,
  external_id,
  slug,
  title,
  status,
  prep_time_minutes,
  cook_time_minutes,
  storage_instructions,
  reheating_instructions,
  cheap_tips,
  substitutions,
  crispiness_level,
  air_fryer_time_minutes,
  air_fryer_temperature_f,
  variant_group,
  variant_type,
  dorm_friendly,
  meal_prep_friendly,
  why_cheap,
  healthier_tips,
  batch_prep_tips,
  optional_add_ins
)
values (
  '99999999-9999-9999-9999-999999999901',
  'test:waivy-metadata',
  'waivy-metadata',
  'Waivy-Metadaten',
  'published',
  10,
  12,
  'Kuehlen.',
  'Mikrowelle.',
  array['Resteverwertung'],
  jsonb_build_array(jsonb_build_object(
    'forIngredientId', 'rice',
    'swap', 'Couscous',
    'savings', 'varies'
  )),
  'crispy',
  8,
  400,
  'fried-rice',
  'original',
  true,
  true,
  'Pantry-Grundzutaten.',
  array['Weniger Oel.'],
  array['Mehr Reis vorkochen.'],
  array['Chili']
);

insert into public.catalog_recipe_components (id, recipe_id, name, serving_grams)
values ('99999999-9999-9999-9999-999999999902', '99999999-9999-9999-9999-999999999901', 'Zutaten', 100);

insert into public.catalog_recipe_component_items (
  id, component_id, recipe_id, ingredient_name, grams, quantity, unit, optional, note
)
values (
  '99999999-9999-9999-9999-999999999903',
  '99999999-9999-9999-9999-999999999902',
  '99999999-9999-9999-9999-999999999901',
  'Reis', 100, 100, 'g', true, 'vorgekocht'
);

insert into public.catalog_recipe_images (
  id, recipe_id, source_url, source_page_url, source_name, license,
  attribution_required, attribution_text, verified_match, alt_text
)
values (
  '99999999-9999-9999-9999-999999999904',
  '99999999-9999-9999-9999-999999999901',
  'https://example.com/recipe.jpg',
  'https://example.com/recipe',
  'Example Commons',
  'CC BY 4.0',
  true,
  'Photo: Example — CC BY 4.0',
  true,
  'Foto des Rezepts'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select is(
  (select prep_time_minutes from public.catalog_recipes where id = '99999999-9999-9999-9999-999999999901'),
  10,
  'der Katalog speichert die Vorbereitungszeit'
);
select is(
  (select storage_instructions from public.catalog_recipes where id = '99999999-9999-9999-9999-999999999901'),
  'Kuehlen.',
  'der Katalog speichert Lagerhinweise'
);
select is(
  (select substitutions->0->>'swap' from public.catalog_recipes where id = '99999999-9999-9999-9999-999999999901'),
  'Couscous',
  'der Katalog speichert strukturierte Substitutionen'
);
select is(
  (select air_fryer_temperature_f from public.catalog_recipes where id = '99999999-9999-9999-9999-999999999901'),
  400,
  'der Katalog speichert Air-Fryer-Metadaten'
);
select is(
  (select meal_prep_friendly from public.catalog_recipes where id = '99999999-9999-9999-9999-999999999901'),
  true,
  'der Katalog speichert Boolesche Rezept-Metadaten'
);
select is(
  (select note from public.catalog_recipe_component_items where id = '99999999-9999-9999-9999-999999999903'),
  'vorgekocht',
  'Katalogzutaten speichern Notizen'
);
select is(
  (select optional from public.catalog_recipe_component_items where id = '99999999-9999-9999-9999-999999999903'),
  true,
  'Katalogzutaten können optional sein'
);
select is(
  (select source_url from public.catalog_recipe_images where id = '99999999-9999-9999-9999-999999999904'),
  'https://example.com/recipe.jpg',
  'Katalogbilder speichern die tatsächliche Bildquelle'
);
select is(
  (select source_page_url from public.catalog_recipe_images where id = '99999999-9999-9999-9999-999999999904'),
  'https://example.com/recipe',
  'Katalogbilder speichern die Attributionsseite'
);
select is_null(
  (select storage_path from public.catalog_recipe_images where id = '99999999-9999-9999-9999-999999999904'),
  'Katalogbilder dürfen zunächst ohne Storage-Pfad importiert werden'
);
select is(
  (select count(*)::int from public.catalog_recipes where status = 'published'),
  1,
  'veröffentlichte Katalogrezepte bleiben lesbar'
);
select is_empty(
  $$ select id from public.catalog_recipes where status = 'draft' $$,
  'Entwürfe bleiben für authentifizierte Nutzer unsichtbar'
);

select * from finish();
rollback;
