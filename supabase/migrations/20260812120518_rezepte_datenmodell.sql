-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE FUNCTION private.check_recipe_component_item_consistency()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  sub_recipe_id uuid;
  creates_cycle boolean;
begin
  if new.sub_component_id is null then
    return new;
  end if;

  if new.sub_component_id = new.component_id then
    raise exception 'Eine Komponente kann sich nicht selbst als Unterkomponente enthalten';
  end if;

  select recipe_id into sub_recipe_id
  from public.recipe_components
  where id = new.sub_component_id;

  if sub_recipe_id is distinct from new.recipe_id then
    raise exception 'Unterkomponente gehoert zu einem anderen Rezept';
  end if;

  -- Wuerde diese Position eine Zykel erzeugen? Pruefe, ob component_id unter
  -- den (transitiven) Unterkomponenten von sub_component_id vorkommt — dann
  -- enthielte component_id am Ende sich selbst.
  with recursive descendants as (
    select new.sub_component_id as comp_id
    union all
    select rci.sub_component_id
    from public.recipe_component_items rci
    join descendants d on rci.component_id = d.comp_id
    where rci.sub_component_id is not null
  )
  select exists (select 1 from descendants where comp_id = new.component_id)
  into creates_cycle;

  if creates_cycle then
    raise exception 'Diese Zuordnung wuerde eine zyklische Komponenten-Verschachtelung erzeugen';
  end if;

  return new;
end;
$function$;

CREATE TABLE public.recipe_component_items (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  component_id     uuid                     NOT NULL,
  recipe_id        uuid                     NOT NULL,
  household_id     uuid                     NOT NULL,
  product_id       uuid,
  sub_component_id uuid,
  grams            numeric(8,2)             NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at       timestamp with time zone
);

COMMENT ON TABLE public.recipe_component_items IS 'Position innerhalb einer Komponente: entweder Zutat (product_id) oder Unterkomponente (sub_component_id), nie beides.';

ALTER TABLE public.recipe_component_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipe_component_items
  ADD CONSTRAINT recipe_component_items_exactly_one_target CHECK (num_nonnulls(product_id, sub_component_id) = 1);

ALTER TABLE public.recipe_component_items
  ADD CONSTRAINT recipe_component_items_grams_check CHECK (grams > 0::numeric);

ALTER TABLE public.recipe_component_items
  ADD CONSTRAINT recipe_component_items_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_component_items
  ADD CONSTRAINT recipe_component_items_pkey PRIMARY KEY (id);

ALTER TABLE public.recipe_component_items
  ADD CONSTRAINT recipe_component_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

GRANT ALL ON public.recipe_component_items TO anon;

GRANT ALL ON public.recipe_component_items TO authenticated;

GRANT ALL ON public.recipe_component_items TO service_role;

CREATE INDEX recipe_component_items_household_updated_idx ON public.recipe_component_items (household_id, updated_at);

CREATE INDEX recipe_component_items_component_id_idx ON public.recipe_component_items (component_id);

CREATE INDEX recipe_component_items_product_id_idx ON public.recipe_component_items (product_id);

CREATE INDEX recipe_component_items_sub_component_id_idx ON public.recipe_component_items (sub_component_id);

CREATE TRIGGER recipe_component_items_check_consistency
  BEFORE INSERT OR UPDATE ON public.recipe_component_items
  FOR EACH ROW
  EXECUTE FUNCTION private.check_recipe_component_item_consistency();

CREATE TRIGGER recipe_component_items_set_updated_at
  BEFORE UPDATE ON public.recipe_component_items
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY recipe_component_items_household ON public.recipe_component_items
  TO authenticated
  USING (( SELECT private.is_household_member(recipe_component_items.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(recipe_component_items.household_id) AS is_household_member));

CREATE TABLE public.recipe_components (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  recipe_id     uuid                     NOT NULL,
  household_id  uuid                     NOT NULL,
  name          text                     NOT NULL,
  serving_grams numeric(8,2),
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at    timestamp with time zone
);

COMMENT ON TABLE public.recipe_components IS 'Baukasten-Komponente eines Rezepts (z. B. "Soße"). serving_grams nur bei obersten Komponenten gesetzt.';

ALTER TABLE public.recipe_components
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipe_components
  ADD CONSTRAINT recipe_components_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_components
  ADD CONSTRAINT recipe_components_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 120);

ALTER TABLE public.recipe_components
  ADD CONSTRAINT recipe_components_pkey PRIMARY KEY (id);

ALTER TABLE public.recipe_component_items
  ADD CONSTRAINT recipe_component_items_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.recipe_components(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_component_items
  ADD CONSTRAINT recipe_component_items_sub_component_id_fkey FOREIGN KEY (sub_component_id) REFERENCES public.recipe_components(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_components
  ADD CONSTRAINT recipe_components_serving_grams_check CHECK (serving_grams > 0::numeric);

GRANT ALL ON public.recipe_components TO anon;

GRANT ALL ON public.recipe_components TO authenticated;

GRANT ALL ON public.recipe_components TO service_role;

CREATE INDEX recipe_components_recipe_id_idx ON public.recipe_components (recipe_id);

CREATE INDEX recipe_components_household_updated_idx ON public.recipe_components (household_id, updated_at);

CREATE TRIGGER recipe_components_set_updated_at
  BEFORE UPDATE ON public.recipe_components
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY recipe_components_household ON public.recipe_components
  TO authenticated
  USING (( SELECT private.is_household_member(recipe_components.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(recipe_components.household_id) AS is_household_member));

CREATE TABLE public.recipes (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  household_id uuid                     NOT NULL,
  title        text                     NOT NULL,
  instructions text,
  created_by   uuid,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at   timestamp with time zone
);

COMMENT ON TABLE public.recipes IS 'Rezeptsammlung, haushaltsweit geteilt. Nicht zwischen Haushalten geteilt.';

ALTER TABLE public.recipes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);

ALTER TABLE public.recipe_component_items
  ADD CONSTRAINT recipe_component_items_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_components
  ADD CONSTRAINT recipe_components_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_title_check CHECK (length(TRIM(BOTH FROM title)) >= 1 AND length(TRIM(BOTH FROM title)) <= 200);

GRANT ALL ON public.recipes TO anon;

GRANT ALL ON public.recipes TO authenticated;

GRANT ALL ON public.recipes TO service_role;

CREATE INDEX recipes_household_id_idx ON public.recipes (household_id);

CREATE INDEX recipes_created_by_idx ON public.recipes (created_by);

CREATE INDEX recipes_household_updated_idx ON public.recipes (household_id, updated_at);

CREATE TRIGGER recipes_set_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY recipes_household ON public.recipes
  TO authenticated
  USING (( SELECT private.is_household_member(recipes.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(recipes.household_id) AS is_household_member));