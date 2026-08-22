-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.shopping_history
  DROP COLUMN category;

ALTER TABLE public.shopping_list_items
  DROP COLUMN category;

ALTER TABLE public.products
  ADD COLUMN off_category_tags text[] DEFAULT '{}'::text[] NOT NULL;

ALTER TABLE public.products
  ADD COLUMN off_last_modified_at timestamp with time zone;

CREATE TABLE public.shopping_category_preferences (
  id                   uuid                     NOT NULL,
  household_id         uuid                     NOT NULL,
  key_type             text                     NOT NULL,
  normalized_key_value text                     NOT NULL,
  category_id          text,
  created_by           uuid,
  created_at           timestamp with time zone DEFAULT now() NOT NULL,
  updated_at           timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at           timestamp with time zone
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_category_preferences;

COMMENT ON TABLE public.shopping_category_preferences IS 'Haushaltsweite Kategorie-Korrekturen mit deterministischer UUIDv5 und Soft Delete.';

ALTER TABLE public.shopping_category_preferences
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shopping_category_preferences
  REPLICA IDENTITY FULL;

ALTER TABLE public.shopping_category_preferences
  ADD CONSTRAINT shopping_category_preferences_category_id_check
    CHECK
    (category_id = ANY (ARRAY['produce'::text, 'bakery'::text, 'deli_meat'::text, 'pantry_canned'::text, 'pantry_dry'::text, 'breakfast'::text, 'snacks'::text, 'beverages'::text,
    'dairy'::text, 'frozen'::text, 'drugstore'::text, 'checkout'::text]));

ALTER TABLE public.shopping_category_preferences
  ADD CONSTRAINT shopping_category_preferences_check
    CHECK
    (length(normalized_key_value) >= 1 AND length(normalized_key_value) <= 500 AND normalized_key_value = lower(TRIM(BOTH FROM normalized_key_value)) AND (key_type <>
    'product'::text OR normalized_key_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text));

ALTER TABLE public.shopping_category_preferences
  ADD CONSTRAINT shopping_category_preferences_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.shopping_category_preferences
  ADD CONSTRAINT shopping_category_preferences_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.shopping_category_preferences
  ADD CONSTRAINT shopping_category_preferences_key_type_check CHECK (key_type = ANY (ARRAY['product'::text, 'name'::text]));

ALTER TABLE public.shopping_category_preferences
  ADD CONSTRAINT shopping_category_preferences_natural_key_key UNIQUE (household_id, key_type, normalized_key_value);

ALTER TABLE public.shopping_category_preferences
  ADD CONSTRAINT shopping_category_preferences_pkey PRIMARY KEY (id);

GRANT INSERT, SELECT, UPDATE ON public.shopping_category_preferences TO authenticated;

GRANT ALL ON public.shopping_category_preferences TO service_role;

CREATE INDEX shopping_category_preferences_created_by_idx ON public.shopping_category_preferences (created_by);

CREATE INDEX shopping_category_preferences_household_updated_idx ON public.shopping_category_preferences (household_id, updated_at, id);

CREATE TRIGGER shopping_category_preferences_set_updated_at
  BEFORE UPDATE ON public.shopping_category_preferences
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY shopping_category_preferences_all_member ON public.shopping_category_preferences
  TO authenticated
  USING (( SELECT private.is_household_member(shopping_category_preferences.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(shopping_category_preferences.household_id) AS is_household_member));

ALTER TABLE public.shopping_history
  ADD COLUMN category_id text;

ALTER TABLE public.shopping_history
  ADD CONSTRAINT shopping_history_category_id_check
    CHECK
    (category_id = ANY (ARRAY['produce'::text, 'bakery'::text, 'deli_meat'::text, 'pantry_canned'::text, 'pantry_dry'::text, 'breakfast'::text, 'snacks'::text, 'beverages'::text,
    'dairy'::text, 'frozen'::text, 'drugstore'::text, 'checkout'::text]));

ALTER TABLE public.shopping_history
  ADD COLUMN category_source text;

ALTER TABLE public.shopping_history
  ADD CONSTRAINT shopping_history_category_source_check
    CHECK (category_source = ANY (ARRAY['user'::text, 'household_preference'::text, 'off_taxonomy'::text, 'name_fallback'::text]));

ALTER TABLE public.shopping_history
  ADD COLUMN category_classifier_version text;

ALTER TABLE public.shopping_history
  ADD CONSTRAINT shopping_history_category_classifier_version_check
    CHECK (category_classifier_version IS NULL OR length(TRIM(BOTH FROM category_classifier_version)) >= 1 AND length(TRIM(BOTH FROM category_classifier_version)) <= 100);

ALTER TABLE public.shopping_list_items
  ADD COLUMN category_id text;

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_category_id_check
    CHECK
    (category_id = ANY (ARRAY['produce'::text, 'bakery'::text, 'deli_meat'::text, 'pantry_canned'::text, 'pantry_dry'::text, 'breakfast'::text, 'snacks'::text, 'beverages'::text,
    'dairy'::text, 'frozen'::text, 'drugstore'::text, 'checkout'::text]));

ALTER TABLE public.shopping_list_items
  ADD COLUMN category_source text;

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_category_source_check
    CHECK (category_source = ANY (ARRAY['user'::text, 'household_preference'::text, 'off_taxonomy'::text, 'name_fallback'::text]));

ALTER TABLE public.shopping_list_items
  ADD COLUMN category_classifier_version text;

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_category_classifier_version_check
    CHECK (category_classifier_version IS NULL OR length(TRIM(BOTH FROM category_classifier_version)) >= 1 AND length(TRIM(BOTH FROM category_classifier_version)) <= 100);