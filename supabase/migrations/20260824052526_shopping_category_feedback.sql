-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.shopping_category_preferences
  DROP CONSTRAINT shopping_category_preferences_natural_key_key;

ALTER TABLE public.shopping_category_preferences
  DROP CONSTRAINT shopping_category_preferences_category_id_check;

ALTER TABLE public.shopping_history
  DROP CONSTRAINT shopping_history_category_id_check;

ALTER TABLE public.shopping_history
  DROP CONSTRAINT shopping_history_category_source_check;

ALTER TABLE public.shopping_list_items
  DROP CONSTRAINT shopping_list_items_category_id_check;

ALTER TABLE public.shopping_list_items
  DROP CONSTRAINT shopping_list_items_category_source_check;

DROP POLICY shopping_category_preferences_all_member ON public.shopping_category_preferences;

CREATE TABLE public.shopping_category_feedback_events (
  event_id                 uuid                     NOT NULL,
  schema_version           smallint                 NOT NULL,
  taxonomy_version         text                     NOT NULL,
  event_type               text                     NOT NULL,
  input_method             text                     NOT NULL,
  household_id             uuid                     NOT NULL,
  actor_user_id            uuid                     NOT NULL,
  shopping_list_item_id    uuid                     NOT NULL,
  product_key_type         text                     NOT NULL,
  product_key              text                     NOT NULL,
  product_id               uuid,
  barcode                  text,
  product_name             text                     NOT NULL,
  store_id                 uuid,
  preference_scope         text                     NOT NULL,
  old_placement_zone       text                     NOT NULL,
  new_placement_zone       text                     NOT NULL,
  predicted_placement_zone text                     NOT NULL,
  old_category_source      text                     NOT NULL,
  new_category_source      text                     NOT NULL,
  predicted_product_family text                     NOT NULL,
  predicted_product_form   text                     NOT NULL,
  classifier_version       text                     NOT NULL,
  platform                 text                     NOT NULL,
  app_version              text                     NOT NULL,
  build_channel            text                     NOT NULL,
  client_created_at        timestamp with time zone NOT NULL,
  created_at               timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.shopping_category_feedback_events IS 'Push-only, pseudonymisierbare Alpha-Signale fuer Einkaufsbereich-Korrekturen.';

ALTER TABLE public.shopping_category_feedback_events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_app_version_check CHECK (length(TRIM(BOTH FROM app_version)) >= 1 AND length(TRIM(BOTH FROM app_version)) <= 100);

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_barcode_check CHECK (barcode IS NULL OR barcode ~ '^[0-9]{6,32}$'::text);

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_build_channel_check CHECK (length(TRIM(BOTH FROM build_channel)) >= 1 AND length(TRIM(BOTH FROM build_channel)) <= 100);

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_event_type_check CHECK (event_type = ANY (ARRAY['manual_reassign'::text, 'reset_to_automatic'::text]));

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_input_method_check CHECK (input_method = ANY (ARRAY['add_form'::text, 'edit_form'::text]));

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_pkey PRIMARY KEY (event_id);

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_platform_check CHECK (platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text]));

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_preference_scope_check CHECK (preference_scope = ANY (ARRAY['store'::text, 'household'::text]));

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_product_key_check CHECK (length(TRIM(BOTH FROM product_key)) >= 1 AND length(TRIM(BOTH FROM product_key)) <= 500);

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_product_key_type_check CHECK (product_key_type = ANY (ARRAY['product'::text, 'barcode'::text, 'name'::text]));

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_product_name_check CHECK (length(TRIM(BOTH FROM product_name)) >= 1 AND length(TRIM(BOTH FROM product_name)) <= 200);

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_schema_version_check CHECK (schema_version = 1);

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_events_taxonomy_version_check CHECK (taxonomy_version = 'placement-taxonomy-v2'::text);

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_key_check CHECK (product_key_type = 'product'::text AND product_id IS NOT NULL OR product_key_type = 'barcode'::text AND barcode IS
    NOT NULL AND product_key = barcode OR product_key_type = 'name'::text AND product_id IS NULL AND barcode IS NULL);

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_manual_change_check CHECK (event_type <> 'manual_reassign'::text OR old_placement_zone IS DISTINCT FROM new_placement_zone);

ALTER TABLE public.shopping_category_feedback_events
  ADD CONSTRAINT shopping_category_feedback_scope_check CHECK (preference_scope = 'store'::text AND store_id IS
    NOT NULL OR preference_scope = 'household'::text AND store_id IS NULL);

GRANT INSERT ON public.shopping_category_feedback_events TO authenticated;

GRANT SELECT ON public.shopping_category_feedback_events TO service_role;

CREATE INDEX shopping_category_feedback_product_key_idx ON public.shopping_category_feedback_events (product_key_type, product_key);

CREATE INDEX shopping_category_feedback_household_created_idx ON public.shopping_category_feedback_events (household_id, created_at, event_id);

CREATE INDEX shopping_category_feedback_created_event_idx ON public.shopping_category_feedback_events (created_at, event_type, event_id);

CREATE INDEX shopping_category_feedback_store_created_idx ON public.shopping_category_feedback_events (store_id, created_at, event_id);

CREATE POLICY shopping_category_feedback_insert_member ON public.shopping_category_feedback_events
  FOR INSERT
  TO authenticated
  WITH
    CHECK
    (((( SELECT auth.uid() AS uid) = actor_user_id) AND ( SELECT private.is_household_member(shopping_category_feedback_events.household_id) AS is_household_member) AND ((store_id
    IS NULL) OR (NOT (EXISTS ( SELECT 1
   FROM public.stores scoped_store
  WHERE (scoped_store.id = shopping_category_feedback_events.store_id)))) OR (EXISTS ( SELECT 1
   FROM public.stores scoped_store
  WHERE ((scoped_store.id = shopping_category_feedback_events.store_id) AND (scoped_store.household_id = shopping_category_feedback_events.household_id)))))));

ALTER TABLE public.shopping_category_preferences
  ADD CONSTRAINT shopping_category_preferences_category_id_check
    CHECK
    (category_id = ANY (ARRAY['fresh_produce'::text, 'bakery'::text, 'chilled_dairy_eggs'::text, 'ambient_milk_drinks'::text, 'chilled_plant_based'::text, 'meat_poultry'::text,
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
    'deli_cold_cuts'::text, 'plant_based'::text, 'dairy_eggs'::text, 'checkout'::text, 'deli_meat'::text, 'pantry_canned'::text, 'pantry_dry'::text, 'dairy'::text]));

ALTER TABLE public.shopping_category_preferences
  ADD COLUMN store_id uuid;

ALTER TABLE public.shopping_category_preferences
  ADD CONSTRAINT shopping_category_preferences_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX shopping_category_preferences_household_key_idx ON public.shopping_category_preferences (household_id, key_type, normalized_key_value)
  WHERE store_id IS NULL;

CREATE UNIQUE INDEX shopping_category_preferences_store_key_idx ON public.shopping_category_preferences (household_id, store_id, key_type, normalized_key_value)
  WHERE store_id IS NOT NULL;

CREATE POLICY shopping_category_preferences_all_member ON public.shopping_category_preferences
  TO authenticated
  USING (( SELECT private.is_household_member(shopping_category_preferences.household_id) AS is_household_member))
  WITH CHECK ((( SELECT private.is_household_member(shopping_category_preferences.household_id) AS is_household_member) AND ((store_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.stores scoped_store
  WHERE ((scoped_store.id = shopping_category_preferences.store_id) AND (scoped_store.household_id = shopping_category_preferences.household_id)))))));

ALTER TABLE public.shopping_history
  ADD CONSTRAINT shopping_history_category_id_check
    CHECK
    (category_id = ANY (ARRAY['fresh_produce'::text, 'bakery'::text, 'chilled_dairy_eggs'::text, 'ambient_milk_drinks'::text, 'chilled_plant_based'::text, 'meat_poultry'::text,
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
    'drugstore'::text, 'baby_kids'::text, 'pet_supplies'::text, 'deli_cold_cuts'::text, 'plant_based'::text, 'dairy_eggs'::text, 'dairy'::text, 'checkout'::text]));

ALTER TABLE public.shopping_history
  ADD CONSTRAINT shopping_history_category_source_check
    CHECK (category_source = ANY (ARRAY['user'::text, 'store_preference'::text, 'household_preference'::text, 'off_taxonomy'::text, 'name_fallback'::text]));

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_category_id_check
    CHECK
    (category_id = ANY (ARRAY['fresh_produce'::text, 'bakery'::text, 'chilled_dairy_eggs'::text, 'ambient_milk_drinks'::text, 'chilled_plant_based'::text, 'meat_poultry'::text,
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
    'deli_cold_cuts'::text, 'plant_based'::text, 'dairy_eggs'::text, 'checkout'::text, 'deli_meat'::text, 'pantry_canned'::text, 'pantry_dry'::text, 'dairy'::text]));

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_category_source_check
    CHECK (category_source = ANY (ARRAY['user'::text, 'store_preference'::text, 'household_preference'::text, 'off_taxonomy'::text, 'name_fallback'::text]));