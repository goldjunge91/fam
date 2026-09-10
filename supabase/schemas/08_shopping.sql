CREATE TABLE public.stores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280'::text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  category_order text,
  package_size numeric(10,3),
  package_size_unit text,
  CONSTRAINT stores_pkey PRIMARY KEY (id),
  CONSTRAINT stores_household_id_fkey FOREIGN KEY (household_id)
    REFERENCES public.households(id) ON DELETE CASCADE,
  CONSTRAINT stores_name_check CHECK (
    length(trim(name)) >= 1 AND length(trim(name)) <= 60
  ),
  CONSTRAINT stores_color_check CHECK (color ~* '^#[0-9a-f]{6}$'),
  CONSTRAINT stores_package_size_check CHECK (package_size > 0::numeric),
  CONSTRAINT stores_package_size_unit_check CHECK (
    package_size_unit = ANY (
      ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'portion'::text]
    )
  ),
  CONSTRAINT shopping_list_items_package_size_complete CHECK (
    (package_size IS NULL) = (package_size_unit IS NULL)
  )
);

CREATE TABLE public.shopping_list_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  product_id uuid,
  name text NOT NULL,
  quantity numeric(10,3) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'piece'::text,
  sort_index integer NOT NULL DEFAULT 0,
  checked_at timestamp with time zone,
  checked_by uuid,
  added_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  store_id uuid,
  price_estimate numeric(10,2),
  recipe_names text[] NOT NULL DEFAULT '{}'::text[],
  package_size numeric(10,3),
  package_size_unit text,
  category_id text,
  category_source text,
  category_classifier_version text,
  CONSTRAINT shopping_list_items_pkey PRIMARY KEY (id),
  CONSTRAINT shopping_list_items_household_id_fkey FOREIGN KEY (household_id)
    REFERENCES public.households(id) ON DELETE CASCADE,
  CONSTRAINT shopping_list_items_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products(id) ON DELETE SET NULL,
  CONSTRAINT shopping_list_items_checked_by_fkey FOREIGN KEY (checked_by)
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT shopping_list_items_added_by_fkey FOREIGN KEY (added_by)
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT shopping_list_items_store_id_fkey FOREIGN KEY (store_id)
    REFERENCES public.stores(id) ON DELETE SET NULL,
  CONSTRAINT shopping_list_items_name_check CHECK (
    length(trim(name)) >= 1 AND length(trim(name)) <= 200
  ),
  CONSTRAINT shopping_list_items_quantity_check CHECK (quantity >= 0::numeric),
  CONSTRAINT shopping_list_items_unit_check CHECK (
    unit = ANY (
      ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'package'::text, 'portion'::text]
    )
  ),
  CONSTRAINT shopping_list_items_price_estimate_check CHECK (price_estimate >= 0::numeric),
  CONSTRAINT shopping_list_items_package_size_check CHECK (package_size > 0::numeric),
  CONSTRAINT shopping_list_items_package_size_unit_check CHECK (
    package_size_unit = ANY (
      ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'portion'::text]
    )
  ),
  CONSTRAINT shopping_list_items_package_size_complete CHECK (
    (package_size IS NULL) = (package_size_unit IS NULL)
  ),
  CONSTRAINT shopping_list_items_category_id_check CHECK (
    category_id = ANY (
      ARRAY[
        'fresh_produce'::text,
        'bakery'::text,
        'chilled_dairy_eggs'::text,
        'ambient_milk_drinks'::text,
        'chilled_plant_based'::text,
        'meat_poultry'::text,
        'fish_seafood'::text,
        'deli'::text,
        'pasta_tomato'::text,
        'rice_world_foods'::text,
        'breakfast'::text,
        'baking'::text,
        'oils_spices'::text,
        'condiments'::text,
        'canned_jars'::text,
        'ready_meals'::text,
        'snacks'::text,
        'sweets'::text,
        'cold_drinks'::text,
        'hot_drinks'::text,
        'alcohol'::text,
        'frozen'::text,
        'baby'::text,
        'pets'::text,
        'household'::text,
        'personal_care'::text,
        'other'::text,
        'produce'::text,
        'convenience'::text,
        'hot_beverages'::text,
        'pantry_staples'::text,
        'cooking_baking'::text,
        'canned_sauces'::text,
        'beverages'::text,
        'drugstore'::text,
        'baby_kids'::text,
        'pet_supplies'::text,
        'deli_cold_cuts'::text,
        'plant_based'::text,
        'dairy_eggs'::text,
        'checkout'::text,
        'deli_meat'::text,
        'pantry_canned'::text,
        'pantry_dry'::text,
        'dairy'::text
      ]
    )
  ),
  CONSTRAINT shopping_list_items_category_source_check CHECK (
    category_source = ANY (
      ARRAY[
        'user'::text,
        'store_preference'::text,
        'household_preference'::text,
        'off_taxonomy'::text,
        'name_fallback'::text
      ]
    )
  ),
  CONSTRAINT shopping_list_items_category_classifier_version_check CHECK (
    category_classifier_version IS NULL
    OR (
      length(trim(category_classifier_version)) >= 1
      AND length(trim(category_classifier_version)) <= 100
    )
  )
);

CREATE TABLE public.shopping_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  completed_by uuid,
  completed_at timestamp with time zone NOT NULL,
  item_name text NOT NULL,
  quantity numeric(10,3) NOT NULL,
  unit text NOT NULL,
  product_id uuid,
  location_kind text,
  expiry_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  category_id text,
  category_source text,
  category_classifier_version text,
  CONSTRAINT shopping_history_pkey PRIMARY KEY (id),
  CONSTRAINT shopping_history_household_id_fkey FOREIGN KEY (household_id)
    REFERENCES public.households(id) ON DELETE CASCADE,
  CONSTRAINT shopping_history_completed_by_fkey FOREIGN KEY (completed_by)
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT shopping_history_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products(id) ON DELETE SET NULL,
  CONSTRAINT shopping_history_location_kind_check CHECK (
    location_kind = ANY (ARRAY['fridge'::text, 'freezer'::text, 'pantry'::text])
  ),
  CONSTRAINT shopping_history_category_id_check CHECK (
    category_id = ANY (
      ARRAY[
        'fresh_produce'::text,
        'bakery'::text,
        'chilled_dairy_eggs'::text,
        'ambient_milk_drinks'::text,
        'chilled_plant_based'::text,
        'meat_poultry'::text,
        'fish_seafood'::text,
        'deli'::text,
        'pasta_tomato'::text,
        'rice_world_foods'::text,
        'breakfast'::text,
        'baking'::text,
        'oils_spices'::text,
        'condiments'::text,
        'canned_jars'::text,
        'ready_meals'::text,
        'snacks'::text,
        'sweets'::text,
        'cold_drinks'::text,
        'hot_drinks'::text,
        'alcohol'::text,
        'frozen'::text,
        'baby'::text,
        'pets'::text,
        'household'::text,
        'personal_care'::text,
        'other'::text,
        'produce'::text,
        'deli_meat'::text,
        'pantry_canned'::text,
        'pantry_dry'::text,
        'convenience'::text,
        'hot_beverages'::text,
        'pantry_staples'::text,
        'cooking_baking'::text,
        'canned_sauces'::text,
        'beverages'::text,
        'drugstore'::text,
        'baby_kids'::text,
        'deli_cold_cuts'::text,
        'plant_based'::text,
        'dairy_eggs'::text,
        'dairy'::text,
        'checkout'::text
      ]
    )
  ),
  CONSTRAINT shopping_history_category_source_check CHECK (
    category_source = ANY (
      ARRAY[
        'user'::text,
        'store_preference'::text,
        'household_preference'::text,
        'off_taxonomy'::text,
        'name_fallback'::text
      ]
    )
  ),
  CONSTRAINT shopping_history_category_classifier_version_check CHECK (
    category_classifier_version IS NULL
    OR (
      length(trim(category_classifier_version)) >= 1
      AND length(trim(category_classifier_version)) <= 100
    )
  )
);

CREATE INDEX stores_household_id_idx ON public.stores USING btree (household_id);

CREATE UNIQUE INDEX stores_household_name_lower_idx
  ON public.stores USING btree (household_id, lower(trim(name)))
  WHERE deleted_at IS NULL;

CREATE INDEX stores_household_updated_idx
  ON public.stores USING btree (household_id, updated_at);

CREATE INDEX shopping_list_items_added_by_idx
  ON public.shopping_list_items USING btree (added_by);

CREATE INDEX shopping_list_items_checked_by_idx
  ON public.shopping_list_items USING btree (checked_by);

CREATE INDEX shopping_list_items_household_id_idx
  ON public.shopping_list_items USING btree (household_id);

CREATE INDEX shopping_list_items_household_updated_idx
  ON public.shopping_list_items USING btree (household_id, updated_at);

CREATE INDEX shopping_list_items_product_id_idx
  ON public.shopping_list_items USING btree (product_id);

CREATE INDEX shopping_list_items_store_id_idx
  ON public.shopping_list_items USING btree (store_id);

CREATE INDEX shopping_history_household_id_idx
  ON public.shopping_history USING btree (household_id);

CREATE INDEX shopping_history_completed_at_idx
  ON public.shopping_history USING btree (household_id, completed_at);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY stores_all_member ON public.stores
  FOR ALL
  TO authenticated
  USING (private.is_household_member(household_id))
  WITH CHECK (private.is_household_member(household_id));

ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY shopping_list_items_all_member ON public.shopping_list_items
  FOR ALL
  TO authenticated
  USING (private.is_household_member(household_id))
  WITH CHECK (private.is_household_member(household_id));

ALTER TABLE public.shopping_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY shopping_history_all_member ON public.shopping_history
  FOR ALL
  TO authenticated
  USING (private.is_household_member(household_id))
  WITH CHECK (private.is_household_member(household_id));

CREATE TRIGGER stores_set_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER shopping_list_items_set_updated_at
  BEFORE UPDATE ON public.shopping_list_items
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

COMMENT ON TABLE public.shopping_list_items IS
  'Geteilte Einkaufsliste. checked_at als Zeitstempel, damit der Einkaufsabschluss rekonstruierbar bleibt.';

COMMENT ON TABLE public.shopping_history IS
  'Historie abgeschlossener Einkäufe. Append-only, kein Offline-Sync-Flag.';
