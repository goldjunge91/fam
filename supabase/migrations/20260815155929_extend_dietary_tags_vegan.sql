-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.recipe_templates
  DROP CONSTRAINT recipe_templates_dietary_tags_check;

ALTER TABLE public.recipes
  DROP CONSTRAINT recipes_dietary_tags_check;

ALTER TABLE public.recipe_templates
  ADD CONSTRAINT recipe_templates_dietary_tags_check
    CHECK (dietary_tags <@ ARRAY['vegetarian'::text, 'vegan'::text, 'high_fat'::text, 'low_fat'::text, 'lactose_free'::text, 'sugar_free'::text, 'gluten_free'::text]);

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_dietary_tags_check
    CHECK (dietary_tags <@ ARRAY['vegetarian'::text, 'vegan'::text, 'high_fat'::text, 'low_fat'::text, 'lactose_free'::text, 'sugar_free'::text, 'gluten_free'::text]);