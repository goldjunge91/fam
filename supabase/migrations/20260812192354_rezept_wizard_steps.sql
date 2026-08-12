-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.recipes
  DROP COLUMN steps;

COMMENT ON TABLE public.recipe_component_items IS 'Position innerhalb einer Komponente: entweder Zutat (product_id) oder Unterkomponente (sub_component_id), nie beides. quantity/unit ist die Roheingabe, grams die daraus abgeleitete kanonische Menge.';

ALTER TABLE public.recipe_component_items
  ADD COLUMN quantity numeric(10,2);

ALTER TABLE public.recipe_component_items
  ADD CONSTRAINT recipe_component_items_quantity_check CHECK (quantity > 0::numeric);

ALTER TABLE public.recipe_component_items
  ADD COLUMN unit text DEFAULT 'g'::text NOT NULL;

ALTER TABLE public.recipe_component_items
  ADD CONSTRAINT recipe_component_items_unit_check CHECK (unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'package'::text, 'portion'::text]));

CREATE TABLE public.recipe_step_ingredients (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  step_id      uuid                     NOT NULL,
  item_id      uuid                     NOT NULL,
  household_id uuid                     NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at   timestamp with time zone
);

COMMENT ON TABLE public.recipe_step_ingredients IS 'Verknuepft einen Zubereitungsschritt mit den darin verwendeten Zutaten-Positionen (recipe_component_items), fuer die Zutaten-Chips im Wizard und in der Detailansicht.';

ALTER TABLE public.recipe_step_ingredients
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipe_step_ingredients
  ADD CONSTRAINT recipe_step_ingredients_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_step_ingredients
  ADD CONSTRAINT recipe_step_ingredients_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.recipe_component_items(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_step_ingredients
  ADD CONSTRAINT recipe_step_ingredients_pkey PRIMARY KEY (id);

ALTER TABLE public.recipe_step_ingredients
  ADD CONSTRAINT recipe_step_ingredients_step_id_item_id_key UNIQUE (step_id, item_id);

GRANT ALL ON public.recipe_step_ingredients TO anon;

GRANT ALL ON public.recipe_step_ingredients TO authenticated;

GRANT ALL ON public.recipe_step_ingredients TO service_role;

CREATE INDEX recipe_step_ingredients_step_id_idx ON public.recipe_step_ingredients (step_id);

CREATE INDEX recipe_step_ingredients_item_id_idx ON public.recipe_step_ingredients (item_id);

CREATE INDEX recipe_step_ingredients_household_updated_idx ON public.recipe_step_ingredients (household_id, updated_at);

CREATE TRIGGER recipe_step_ingredients_set_updated_at
  BEFORE UPDATE ON public.recipe_step_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY recipe_step_ingredients_household ON public.recipe_step_ingredients
  TO authenticated
  USING (( SELECT private.is_household_member(recipe_step_ingredients.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(recipe_step_ingredients.household_id) AS is_household_member));

CREATE TABLE public.recipe_steps (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  recipe_id    uuid                     NOT NULL,
  household_id uuid                     NOT NULL,
  "position"   integer                  NOT NULL,
  text         text                     NOT NULL,
  image_path   text,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at   timestamp with time zone
);

COMMENT ON TABLE public.recipe_steps IS 'Ein Zubereitungsschritt eines Rezepts, in Reihenfolge ueber position. image_path zeigt in den recipe-step-images-Bucket (13_recipe_step_storage.sql).';

ALTER TABLE public.recipe_steps
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipe_steps
  ADD CONSTRAINT recipe_steps_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_steps
  ADD CONSTRAINT recipe_steps_pkey PRIMARY KEY (id);

ALTER TABLE public.recipe_step_ingredients
  ADD CONSTRAINT recipe_step_ingredients_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.recipe_steps(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_steps
  ADD CONSTRAINT recipe_steps_position_check CHECK ("position" >= 0);

ALTER TABLE public.recipe_steps
  ADD CONSTRAINT recipe_steps_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_steps
  ADD CONSTRAINT recipe_steps_text_check CHECK (length(TRIM(BOTH FROM text)) >= 1 AND length(TRIM(BOTH FROM text)) <= 2000);

GRANT ALL ON public.recipe_steps TO anon;

GRANT ALL ON public.recipe_steps TO authenticated;

GRANT ALL ON public.recipe_steps TO service_role;

CREATE INDEX recipe_steps_household_updated_idx ON public.recipe_steps (household_id, updated_at);

CREATE INDEX recipe_steps_recipe_id_idx ON public.recipe_steps (recipe_id);

CREATE TRIGGER recipe_steps_set_updated_at
  BEFORE UPDATE ON public.recipe_steps
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY recipe_steps_household ON public.recipe_steps
  TO authenticated
  USING (( SELECT private.is_household_member(recipe_steps.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(recipe_steps.household_id) AS is_household_member));