-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE FUNCTION private.catalog_recipe_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE TABLE public.catalog_recipe_component_items (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  component_id     uuid                     NOT NULL,
  recipe_id        uuid                     NOT NULL,
  product_id       uuid,
  sub_component_id uuid,
  ingredient_name  text,
  grams            numeric(8,2)             NOT NULL,
  quantity         numeric(10,2),
  unit             text                     DEFAULT 'g'::text NOT NULL,
  "position"       integer                  DEFAULT 0 NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.catalog_recipe_component_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.catalog_recipe_component_items
  ADD CONSTRAINT catalog_recipe_component_items_grams_check CHECK (grams > 0::numeric);

ALTER TABLE public.catalog_recipe_component_items
  ADD CONSTRAINT catalog_recipe_component_items_pkey PRIMARY KEY (id);

ALTER TABLE public.catalog_recipe_component_items
  ADD CONSTRAINT catalog_recipe_component_items_position_check CHECK ("position" >= 0);

ALTER TABLE public.catalog_recipe_component_items
  ADD CONSTRAINT catalog_recipe_component_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.catalog_recipe_component_items
  ADD CONSTRAINT catalog_recipe_component_items_quantity_check CHECK (quantity > 0::numeric);

ALTER TABLE public.catalog_recipe_component_items
  ADD CONSTRAINT catalog_recipe_component_items_unit_check CHECK (unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'package'::text, 'portion'::text]));

ALTER TABLE public.catalog_recipe_component_items
  ADD CONSTRAINT catalog_recipe_items_target_check CHECK (num_nonnulls(product_id, sub_component_id, ingredient_name) = 1);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipe_component_items TO anon;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.catalog_recipe_component_items TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipe_component_items TO service_role;

CREATE INDEX catalog_recipe_items_component_idx ON public.catalog_recipe_component_items (component_id, "position");

CREATE INDEX catalog_recipe_items_recipe_idx ON public.catalog_recipe_component_items (recipe_id);

CREATE TRIGGER catalog_recipe_items_set_updated_at
  BEFORE UPDATE ON public.catalog_recipe_component_items
  FOR EACH ROW
  EXECUTE FUNCTION private.catalog_recipe_updated_at();

CREATE TABLE public.catalog_recipe_components (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  recipe_id     uuid                     NOT NULL,
  name          text                     NOT NULL,
  serving_grams numeric(8,2),
  "position"    integer                  DEFAULT 0 NOT NULL,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.catalog_recipe_components
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.catalog_recipe_components
  ADD CONSTRAINT catalog_recipe_components_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 120);

ALTER TABLE public.catalog_recipe_components
  ADD CONSTRAINT catalog_recipe_components_pkey PRIMARY KEY (id);

ALTER TABLE public.catalog_recipe_component_items
  ADD CONSTRAINT catalog_recipe_component_items_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.catalog_recipe_components(id) ON DELETE CASCADE;

ALTER TABLE public.catalog_recipe_component_items
  ADD CONSTRAINT catalog_recipe_component_items_sub_component_id_fkey FOREIGN KEY (sub_component_id) REFERENCES public.catalog_recipe_components(id) ON DELETE CASCADE;

ALTER TABLE public.catalog_recipe_components
  ADD CONSTRAINT catalog_recipe_components_position_check CHECK ("position" >= 0);

ALTER TABLE public.catalog_recipe_components
  ADD CONSTRAINT catalog_recipe_components_serving_grams_check CHECK (serving_grams > 0::numeric);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipe_components TO anon;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.catalog_recipe_components TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipe_components TO service_role;

CREATE INDEX catalog_recipe_components_recipe_idx ON public.catalog_recipe_components (recipe_id, "position");

CREATE TRIGGER catalog_recipe_components_set_updated_at
  BEFORE UPDATE ON public.catalog_recipe_components
  FOR EACH ROW
  EXECUTE FUNCTION private.catalog_recipe_updated_at();

CREATE TABLE public.catalog_recipe_images (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  recipe_id    uuid                     NOT NULL,
  storage_path text                     NOT NULL,
  alt_text     text,
  "position"   integer                  DEFAULT 0 NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.catalog_recipe_images
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.catalog_recipe_images
  ADD CONSTRAINT catalog_recipe_images_pkey PRIMARY KEY (id);

ALTER TABLE public.catalog_recipe_images
  ADD CONSTRAINT catalog_recipe_images_position_check CHECK ("position" >= 0);

ALTER TABLE public.catalog_recipe_images
  ADD CONSTRAINT catalog_recipe_images_storage_path_key UNIQUE (storage_path);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipe_images TO anon;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.catalog_recipe_images TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipe_images TO service_role;

CREATE INDEX catalog_recipe_images_recipe_idx ON public.catalog_recipe_images (recipe_id, "position");

CREATE TABLE public.catalog_recipe_step_images (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  step_id      uuid                     NOT NULL,
  recipe_id    uuid                     NOT NULL,
  storage_path text                     NOT NULL,
  alt_text     text,
  "position"   integer                  DEFAULT 0 NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.catalog_recipe_step_images
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.catalog_recipe_step_images
  ADD CONSTRAINT catalog_recipe_step_images_pkey PRIMARY KEY (id);

ALTER TABLE public.catalog_recipe_step_images
  ADD CONSTRAINT catalog_recipe_step_images_position_check CHECK ("position" >= 0);

ALTER TABLE public.catalog_recipe_step_images
  ADD CONSTRAINT catalog_recipe_step_images_storage_path_key UNIQUE (storage_path);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipe_step_images TO anon;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.catalog_recipe_step_images TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipe_step_images TO service_role;

CREATE INDEX catalog_recipe_step_images_step_idx ON public.catalog_recipe_step_images (step_id, "position");

CREATE TABLE public.catalog_recipe_step_ingredients (
  step_id    uuid    NOT NULL,
  item_id    uuid    NOT NULL,
  recipe_id  uuid    NOT NULL,
  "position" integer DEFAULT 0 NOT NULL
);

ALTER TABLE public.catalog_recipe_step_ingredients
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.catalog_recipe_step_ingredients
  ADD CONSTRAINT catalog_recipe_step_ingredients_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.catalog_recipe_component_items(id) ON DELETE CASCADE;

ALTER TABLE public.catalog_recipe_step_ingredients
  ADD CONSTRAINT catalog_recipe_step_ingredients_pkey PRIMARY KEY (step_id, item_id);

ALTER TABLE public.catalog_recipe_step_ingredients
  ADD CONSTRAINT catalog_recipe_step_ingredients_position_check CHECK ("position" >= 0);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipe_step_ingredients TO anon;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.catalog_recipe_step_ingredients TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipe_step_ingredients TO service_role;

CREATE INDEX catalog_recipe_step_ingredients_recipe_idx ON public.catalog_recipe_step_ingredients (recipe_id, step_id, "position");

CREATE TABLE public.catalog_recipe_steps (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  recipe_id     uuid                     NOT NULL,
  "position"    integer                  NOT NULL,
  text          text                     NOT NULL,
  timer_minutes integer,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.catalog_recipe_steps
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.catalog_recipe_steps
  ADD CONSTRAINT catalog_recipe_steps_pkey PRIMARY KEY (id);

ALTER TABLE public.catalog_recipe_step_images
  ADD CONSTRAINT catalog_recipe_step_images_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.catalog_recipe_steps(id) ON DELETE CASCADE;

ALTER TABLE public.catalog_recipe_step_ingredients
  ADD CONSTRAINT catalog_recipe_step_ingredients_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.catalog_recipe_steps(id) ON DELETE CASCADE;

ALTER TABLE public.catalog_recipe_steps
  ADD CONSTRAINT catalog_recipe_steps_position_check CHECK ("position" >= 0);

ALTER TABLE public.catalog_recipe_steps
  ADD CONSTRAINT catalog_recipe_steps_recipe_id_position_key UNIQUE (recipe_id, "position");

ALTER TABLE public.catalog_recipe_steps
  ADD CONSTRAINT catalog_recipe_steps_text_check CHECK (length(TRIM(BOTH FROM text)) >= 1 AND length(TRIM(BOTH FROM text)) <= 2000);

ALTER TABLE public.catalog_recipe_steps
  ADD CONSTRAINT catalog_recipe_steps_timer_minutes_check CHECK (timer_minutes > 0);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipe_steps TO anon;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.catalog_recipe_steps TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipe_steps TO service_role;

CREATE TRIGGER catalog_recipe_steps_set_updated_at
  BEFORE UPDATE ON public.catalog_recipe_steps
  FOR EACH ROW
  EXECUTE FUNCTION private.catalog_recipe_updated_at();

CREATE TABLE public.catalog_recipes (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  external_id       text                     NOT NULL,
  slug              text                     NOT NULL,
  title             text                     NOT NULL,
  instructions      text,
  cook_time_minutes integer,
  difficulty        text,
  dish_types        text[]                   DEFAULT '{}'::text[] NOT NULL,
  dietary_tags      text[]                   DEFAULT '{}'::text[] NOT NULL,
  hashtags          text[]                   DEFAULT '{}'::text[] NOT NULL,
  default_servings  integer                  DEFAULT 1 NOT NULL,
  status            text                     DEFAULT 'draft'::text NOT NULL,
  sort_order        integer                  DEFAULT 0 NOT NULL,
  source_url        text,
  created_at        timestamp with time zone DEFAULT now() NOT NULL,
  updated_at        timestamp with time zone DEFAULT now() NOT NULL,
  published_at      timestamp with time zone
);

CREATE POLICY catalog_items_select_published ON public.catalog_recipe_component_items
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.catalog_recipes r
  WHERE ((r.id = catalog_recipe_component_items.recipe_id) AND (r.status = 'published'::text)))));

CREATE POLICY catalog_components_select_published ON public.catalog_recipe_components
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.catalog_recipes r
  WHERE ((r.id = catalog_recipe_components.recipe_id) AND (r.status = 'published'::text)))));

CREATE POLICY catalog_images_select_published ON public.catalog_recipe_images
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.catalog_recipes r
  WHERE ((r.id = catalog_recipe_images.recipe_id) AND (r.status = 'published'::text)))));

CREATE POLICY catalog_step_images_select_published ON public.catalog_recipe_step_images
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (public.catalog_recipe_steps s
     JOIN public.catalog_recipes r ON ((r.id = s.recipe_id)))
  WHERE ((s.id = catalog_recipe_step_images.step_id) AND (r.status = 'published'::text)))));

CREATE POLICY catalog_step_ingredients_select_published ON public.catalog_recipe_step_ingredients
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.catalog_recipes r
  WHERE ((r.id = catalog_recipe_step_ingredients.recipe_id) AND (r.status = 'published'::text)))));

CREATE POLICY catalog_steps_select_published ON public.catalog_recipe_steps
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.catalog_recipes r
  WHERE ((r.id = catalog_recipe_steps.recipe_id) AND (r.status = 'published'::text)))));

ALTER TABLE public.catalog_recipes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.catalog_recipes
  ADD CONSTRAINT catalog_recipes_cook_time_minutes_check CHECK (cook_time_minutes > 0);

ALTER TABLE public.catalog_recipes
  ADD CONSTRAINT catalog_recipes_default_servings_check CHECK (default_servings > 0);

ALTER TABLE public.catalog_recipes
  ADD CONSTRAINT catalog_recipes_dietary_tags_check
    CHECK (dietary_tags <@ ARRAY['vegetarian'::text, 'vegan'::text, 'high_fat'::text, 'low_fat'::text, 'lactose_free'::text, 'sugar_free'::text, 'gluten_free'::text]);

ALTER TABLE public.catalog_recipes
  ADD CONSTRAINT catalog_recipes_difficulty_check CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text]));

ALTER TABLE public.catalog_recipes
  ADD CONSTRAINT catalog_recipes_dish_types_check
    CHECK (dish_types <@ ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text, 'dessert'::text, 'appetizer'::text, 'brunch'::text]);

ALTER TABLE public.catalog_recipes
  ADD CONSTRAINT catalog_recipes_external_id_key UNIQUE (external_id);

ALTER TABLE public.catalog_recipes
  ADD CONSTRAINT catalog_recipes_pkey PRIMARY KEY (id);

ALTER TABLE public.catalog_recipe_component_items
  ADD CONSTRAINT catalog_recipe_component_items_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.catalog_recipes(id) ON DELETE CASCADE;

ALTER TABLE public.catalog_recipe_components
  ADD CONSTRAINT catalog_recipe_components_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.catalog_recipes(id) ON DELETE CASCADE;

ALTER TABLE public.catalog_recipe_images
  ADD CONSTRAINT catalog_recipe_images_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.catalog_recipes(id) ON DELETE CASCADE;

ALTER TABLE public.catalog_recipe_step_images
  ADD CONSTRAINT catalog_recipe_step_images_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.catalog_recipes(id) ON DELETE CASCADE;

ALTER TABLE public.catalog_recipe_step_ingredients
  ADD CONSTRAINT catalog_recipe_step_ingredients_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.catalog_recipes(id) ON DELETE CASCADE;

ALTER TABLE public.catalog_recipe_steps
  ADD CONSTRAINT catalog_recipe_steps_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.catalog_recipes(id) ON DELETE CASCADE;

ALTER TABLE public.catalog_recipes
  ADD CONSTRAINT catalog_recipes_slug_check CHECK (length(TRIM(BOTH FROM slug)) >= 1 AND length(TRIM(BOTH FROM slug)) <= 160);

ALTER TABLE public.catalog_recipes
  ADD CONSTRAINT catalog_recipes_slug_key UNIQUE (slug);

ALTER TABLE public.catalog_recipes
  ADD CONSTRAINT catalog_recipes_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]));

ALTER TABLE public.catalog_recipes
  ADD CONSTRAINT catalog_recipes_title_check CHECK (length(TRIM(BOTH FROM title)) >= 1 AND length(TRIM(BOTH FROM title)) <= 200);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipes TO anon;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.catalog_recipes TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.catalog_recipes TO service_role;

CREATE INDEX catalog_recipes_status_sort_idx ON public.catalog_recipes (status, sort_order, title);

CREATE TRIGGER catalog_recipes_set_updated_at
  BEFORE UPDATE ON public.catalog_recipes
  FOR EACH ROW
  EXECUTE FUNCTION private.catalog_recipe_updated_at();

CREATE POLICY catalog_recipes_select_published ON public.catalog_recipes
  FOR SELECT
  TO authenticated
  USING ((status = 'published'::text));