-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.recipes
  ADD COLUMN steps text[] DEFAULT '{}'::text[] NOT NULL;

ALTER TABLE public.recipes
  ADD COLUMN cover_image_path text;

ALTER TABLE public.recipes
  ADD COLUMN cook_time_minutes integer;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_cook_time_minutes_check CHECK (cook_time_minutes > 0);

ALTER TABLE public.recipes
  ADD COLUMN difficulty text;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_difficulty_check CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text]));

ALTER TABLE public.recipes
  ADD COLUMN dish_types text[] DEFAULT '{}'::text[] NOT NULL;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_dish_types_check
    CHECK (dish_types <@ ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text, 'dessert'::text, 'appetizer'::text, 'brunch'::text]);

ALTER TABLE public.recipes
  ADD COLUMN dietary_tags text[] DEFAULT '{}'::text[] NOT NULL;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_dietary_tags_check
    CHECK (dietary_tags <@ ARRAY['vegetarian'::text, 'high_fat'::text, 'low_fat'::text, 'lactose_free'::text, 'sugar_free'::text, 'gluten_free'::text]);

ALTER TABLE public.recipes
  ADD COLUMN hashtags text[] DEFAULT '{}'::text[] NOT NULL;

ALTER TABLE public.recipes
  ADD COLUMN default_servings integer DEFAULT 1 NOT NULL;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_default_servings_check CHECK (default_servings > 0);