-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE FUNCTION private.check_recipe_template_item_consistency()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  sub_template_id uuid;
  creates_cycle boolean;
begin
  if new.sub_component_id is null then
    return new;
  end if;

  if new.sub_component_id = new.component_id then
    raise exception 'Eine Komponente kann sich nicht selbst als Unterkomponente enthalten';
  end if;

  select template_id into sub_template_id
  from public.recipe_template_components
  where id = new.sub_component_id;

  if sub_template_id is distinct from new.template_id then
    raise exception 'Unterkomponente gehoert zu einer anderen Vorlage';
  end if;

  with recursive descendants as (
    select new.sub_component_id as comp_id
    union all
    select rti.sub_component_id
    from public.recipe_template_items rti
    join descendants d on rti.component_id = d.comp_id
    where rti.sub_component_id is not null
  )
  select exists (select 1 from descendants where comp_id = new.component_id)
  into creates_cycle;

  if creates_cycle then
    raise exception 'Diese Zuordnung wuerde eine zyklische Komponenten-Verschachtelung erzeugen';
  end if;

  return new;
end;
$function$;

CREATE TABLE public.recipe_template_components (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  template_id   uuid                     NOT NULL,
  name          text                     NOT NULL,
  serving_grams numeric(8,2),
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.recipe_template_components IS 'Baukasten-Komponente einer Rezeptvorlage, analog zu recipe_components.';

ALTER TABLE public.recipe_template_components
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipe_template_components
  ADD CONSTRAINT recipe_template_components_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 120);

ALTER TABLE public.recipe_template_components
  ADD CONSTRAINT recipe_template_components_pkey PRIMARY KEY (id);

ALTER TABLE public.recipe_template_components
  ADD CONSTRAINT recipe_template_components_serving_grams_check CHECK (serving_grams > 0::numeric);

GRANT ALL ON public.recipe_template_components TO anon;

GRANT ALL ON public.recipe_template_components TO authenticated;

GRANT ALL ON public.recipe_template_components TO service_role;

CREATE INDEX recipe_template_components_template_id_idx ON public.recipe_template_components (template_id);

CREATE TRIGGER recipe_template_components_set_updated_at
  BEFORE UPDATE ON public.recipe_template_components
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY recipe_template_components_select_all ON public.recipe_template_components
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE public.recipe_template_items (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  component_id     uuid                     NOT NULL,
  template_id      uuid                     NOT NULL,
  product_id       uuid,
  sub_component_id uuid,
  grams            numeric(8,2)             NOT NULL,
  quantity         numeric(10,2),
  unit             text                     DEFAULT 'g'::text NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.recipe_template_items IS 'Position innerhalb einer Vorlagen-Komponente: Zutat (product_id) oder Unterkomponente (sub_component_id), nie beides.';

ALTER TABLE public.recipe_template_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipe_template_items
  ADD CONSTRAINT recipe_template_items_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.recipe_template_components(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_template_items
  ADD CONSTRAINT recipe_template_items_exactly_one_target CHECK (num_nonnulls(product_id, sub_component_id) = 1);

ALTER TABLE public.recipe_template_items
  ADD CONSTRAINT recipe_template_items_grams_check CHECK (grams > 0::numeric);

ALTER TABLE public.recipe_template_items
  ADD CONSTRAINT recipe_template_items_pkey PRIMARY KEY (id);

ALTER TABLE public.recipe_template_items
  ADD CONSTRAINT recipe_template_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.recipe_template_items
  ADD CONSTRAINT recipe_template_items_quantity_check CHECK (quantity > 0::numeric);

ALTER TABLE public.recipe_template_items
  ADD CONSTRAINT recipe_template_items_sub_component_id_fkey FOREIGN KEY (sub_component_id) REFERENCES public.recipe_template_components(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_template_items
  ADD CONSTRAINT recipe_template_items_unit_check CHECK (unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'package'::text, 'portion'::text]));

GRANT ALL ON public.recipe_template_items TO anon;

GRANT ALL ON public.recipe_template_items TO authenticated;

GRANT ALL ON public.recipe_template_items TO service_role;

CREATE INDEX recipe_template_items_component_id_idx ON public.recipe_template_items (component_id);

CREATE INDEX recipe_template_items_sub_component_id_idx ON public.recipe_template_items (sub_component_id);

CREATE INDEX recipe_template_items_product_id_idx ON public.recipe_template_items (product_id);

CREATE TRIGGER recipe_template_items_check_consistency
  BEFORE INSERT OR UPDATE ON public.recipe_template_items
  FOR EACH ROW
  EXECUTE FUNCTION private.check_recipe_template_item_consistency();

CREATE TRIGGER recipe_template_items_set_updated_at
  BEFORE UPDATE ON public.recipe_template_items
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY recipe_template_items_select_all ON public.recipe_template_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE public.recipe_template_steps (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  template_id uuid                     NOT NULL,
  "position"  integer                  NOT NULL,
  text        text                     NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.recipe_template_steps IS 'Ein Zubereitungsschritt einer Rezeptvorlage, in Reihenfolge ueber position. Anders als recipe_steps kein image_path/keine Zutaten-Verknuepfung (Scope-Cut).';

ALTER TABLE public.recipe_template_steps
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipe_template_steps
  ADD CONSTRAINT recipe_template_steps_pkey PRIMARY KEY (id);

ALTER TABLE public.recipe_template_steps
  ADD CONSTRAINT recipe_template_steps_position_check CHECK ("position" >= 0);

ALTER TABLE public.recipe_template_steps
  ADD CONSTRAINT recipe_template_steps_text_check CHECK (length(TRIM(BOTH FROM text)) >= 1 AND length(TRIM(BOTH FROM text)) <= 2000);

GRANT ALL ON public.recipe_template_steps TO anon;

GRANT ALL ON public.recipe_template_steps TO authenticated;

GRANT ALL ON public.recipe_template_steps TO service_role;

CREATE INDEX recipe_template_steps_template_id_idx ON public.recipe_template_steps (template_id);

CREATE TRIGGER recipe_template_steps_set_updated_at
  BEFORE UPDATE ON public.recipe_template_steps
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY recipe_template_steps_select_all ON public.recipe_template_steps
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE public.recipe_templates (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  title             text                     NOT NULL,
  instructions      text,
  cover_image_path  text,
  cook_time_minutes integer,
  difficulty        text,
  dish_types        text[]                   DEFAULT '{}'::text[] NOT NULL,
  dietary_tags      text[]                   DEFAULT '{}'::text[] NOT NULL,
  hashtags          text[]                   DEFAULT '{}'::text[] NOT NULL,
  default_servings  integer                  DEFAULT 1 NOT NULL,
  sort_order        integer                  DEFAULT 0 NOT NULL,
  created_at        timestamp with time zone DEFAULT now() NOT NULL,
  updated_at        timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.recipe_templates IS 'Admin-kuratierte Rezeptvorlagen, global lesbar, read-only fuer Clients. Wird per Client-Kopiervorgang in recipes uebernommen.';

ALTER TABLE public.recipe_templates
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipe_templates
  ADD CONSTRAINT recipe_templates_cook_time_minutes_check CHECK (cook_time_minutes > 0);

ALTER TABLE public.recipe_templates
  ADD CONSTRAINT recipe_templates_default_servings_check CHECK (default_servings > 0);

ALTER TABLE public.recipe_templates
  ADD CONSTRAINT recipe_templates_dietary_tags_check
    CHECK (dietary_tags <@ ARRAY['vegetarian'::text, 'high_fat'::text, 'low_fat'::text, 'lactose_free'::text, 'sugar_free'::text, 'gluten_free'::text]);

ALTER TABLE public.recipe_templates
  ADD CONSTRAINT recipe_templates_difficulty_check CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text]));

ALTER TABLE public.recipe_templates
  ADD CONSTRAINT recipe_templates_dish_types_check
    CHECK (dish_types <@ ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text, 'dessert'::text, 'appetizer'::text, 'brunch'::text]);

ALTER TABLE public.recipe_templates
  ADD CONSTRAINT recipe_templates_pkey PRIMARY KEY (id);

ALTER TABLE public.recipe_template_components
  ADD CONSTRAINT recipe_template_components_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.recipe_templates(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_template_items
  ADD CONSTRAINT recipe_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.recipe_templates(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_template_steps
  ADD CONSTRAINT recipe_template_steps_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.recipe_templates(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_templates
  ADD CONSTRAINT recipe_templates_title_check CHECK (length(TRIM(BOTH FROM title)) >= 1 AND length(TRIM(BOTH FROM title)) <= 200);

GRANT ALL ON public.recipe_templates TO anon;

GRANT ALL ON public.recipe_templates TO authenticated;

GRANT ALL ON public.recipe_templates TO service_role;

CREATE INDEX recipe_templates_sort_order_idx ON public.recipe_templates (sort_order);

CREATE INDEX recipe_templates_updated_idx ON public.recipe_templates (updated_at, id);

CREATE TRIGGER recipe_templates_set_updated_at
  BEFORE UPDATE ON public.recipe_templates
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY recipe_templates_select_all ON public.recipe_templates
  FOR SELECT
  TO authenticated
  USING (true);