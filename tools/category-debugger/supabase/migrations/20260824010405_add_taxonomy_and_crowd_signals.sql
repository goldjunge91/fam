-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.evaluation_crowd_signal_reviews (
  id                bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  signal_id         bigint                   NOT NULL,
  reviewer_id       bigint                   NOT NULL,
  decision          text                     NOT NULL,
  product_family_id text,
  product_form_id   text,
  placement_zone_id text,
  training_approved boolean                  DEFAULT false NOT NULL,
  note              text,
  created_at        timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.evaluation_crowd_signal_reviews
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.evaluation_crowd_signal_reviews
  ADD CONSTRAINT evaluation_crowd_signal_reviews_complete_check CHECK (decision = 'confirmed'::text AND product_family_id IS NOT NULL AND product_form_id IS
    NOT NULL AND placement_zone_id IS
    NOT NULL OR decision <> 'confirmed'::text AND product_family_id IS NULL AND product_form_id IS NULL AND placement_zone_id IS NULL AND training_approved = false);

ALTER TABLE public.evaluation_crowd_signal_reviews
  ADD CONSTRAINT evaluation_crowd_signal_reviews_decision_check CHECK (decision = ANY (ARRAY['confirmed'::text, 'rejected'::text, 'duplicate'::text, 'insufficient_context'::text]));

ALTER TABLE public.evaluation_crowd_signal_reviews
  ADD CONSTRAINT evaluation_crowd_signal_reviews_family_check
    CHECK
    (product_family_id IS NULL OR (product_family_id = ANY (ARRAY['fruit'::text, 'vegetables'::text, 'herbs'::text, 'potatoes_onions'::text, 'bread_baked_goods'::text,
    'milk'::text,
    'plant_drink'::text,
    'cream'::text,
    'yogurt'::text,
    'cheese'::text,
    'butter_margarine'::text,
    'eggs'::text,
    'chilled_dessert'::text,
    'tofu_meat_alternative'::text,
    'meat'::text,
    'poultry'::text,
    'fish_seafood'::text,
    'deli_cold_cuts'::text,
    'pasta'::text,
    'rice'::text,
    'grains'::text,
    'legumes'::text,
    'flour_baking'::text,
    'oil_vinegar'::text,
    'spices_seasoning'::text,
    'sugar_sweeteners'::text,
    'tomato_products'::text,
    'pasta_sauce'::text,
    'condiments'::text,
    'canned_food'::text,
    'soup_ready_meal'::text,
    'spreads'::text,
    'breakfast_cereal'::text,
    'savory_snacks'::text,
    'sweets'::text,
    'nuts_dried_fruit'::text,
    'water_soft_drinks'::text,
    'juice'::text,
    'alcoholic_beverages'::text, 'coffee'::text, 'tea'::text, 'baby_food'::text, 'pet_food'::text, 'household_cleaning'::text, 'personal_care'::text, 'other_food'::text])));

ALTER TABLE public.evaluation_crowd_signal_reviews
  ADD CONSTRAINT evaluation_crowd_signal_reviews_form_check
    CHECK
    (product_form_id IS NULL OR (product_form_id = ANY (ARRAY['fresh'::text, 'chilled'::text, 'ambient'::text, 'frozen'::text, 'canned_jarred'::text, 'dry'::text,
    'prepared'::text])));

ALTER TABLE public.evaluation_crowd_signal_reviews
  ADD CONSTRAINT evaluation_crowd_signal_reviews_note_check CHECK (note IS NULL OR char_length(note) <= 2000);

ALTER TABLE public.evaluation_crowd_signal_reviews
  ADD CONSTRAINT evaluation_crowd_signal_reviews_pkey PRIMARY KEY (id);

ALTER TABLE public.evaluation_crowd_signal_reviews
  ADD CONSTRAINT evaluation_crowd_signal_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.evaluation_reviewers(id) ON DELETE RESTRICT;

ALTER TABLE public.evaluation_crowd_signal_reviews
  ADD CONSTRAINT evaluation_crowd_signal_reviews_training_check CHECK (training_approved = false OR decision = 'confirmed'::text);

ALTER TABLE public.evaluation_crowd_signal_reviews
  ADD CONSTRAINT evaluation_crowd_signal_reviews_zone_check
    CHECK
    (placement_zone_id IS NULL OR (placement_zone_id = ANY (ARRAY['fresh_produce'::text, 'bakery'::text, 'chilled_dairy_eggs'::text, 'ambient_milk_drinks'::text,
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
    'cold_drinks'::text, 'hot_drinks'::text, 'alcohol'::text, 'frozen'::text, 'baby'::text, 'pets'::text, 'household'::text, 'personal_care'::text, 'other'::text])));

GRANT INSERT, SELECT ON public.evaluation_crowd_signal_reviews TO service_role;

CREATE INDEX evaluation_crowd_signal_reviews_signal_idx ON public.evaluation_crowd_signal_reviews (signal_id, created_at DESC, id DESC);

CREATE INDEX evaluation_crowd_signal_reviews_training_idx ON public.evaluation_crowd_signal_reviews (training_approved, created_at DESC)
  WHERE training_approved = true;

CREATE POLICY evaluation_server_only ON public.evaluation_crowd_signal_reviews
  AS RESTRICTIVE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE TABLE public.evaluation_crowd_signals (
  id                 bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  event_id           text                     NOT NULL,
  schema_version     integer                  NOT NULL,
  source             text                     NOT NULL,
  event_type         text                     NOT NULL,
  occurred_at        timestamp with time zone NOT NULL,
  received_at        timestamp with time zone DEFAULT now() NOT NULL,
  actor_key          text                     NOT NULL,
  household_key      text                     NOT NULL,
  store_key          text,
  product_key        text                     NOT NULL,
  barcode            text,
  product_name       text                     NOT NULL,
  from_zone_id       text,
  to_zone_id         text                     NOT NULL,
  classifier_version text                     NOT NULL,
  payload_sha256     text                     NOT NULL,
  raw_payload        jsonb                    NOT NULL
);

ALTER TABLE public.evaluation_crowd_signals
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_actor_key_check CHECK (char_length(actor_key) >= 1 AND char_length(actor_key) <= 200);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_barcode_check CHECK (barcode IS NULL OR barcode ~ '^[0-9]{6,32}$'::text);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_classifier_version_check CHECK (char_length(classifier_version) >= 1 AND char_length(classifier_version) <= 100);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_event_id_check CHECK (char_length(event_id) >= 1 AND char_length(event_id) <= 200);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_event_id_key UNIQUE (event_id);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_event_type_check CHECK (event_type = 'product_moved'::text);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_from_zone_check CHECK (from_zone_id IS NULL OR char_length(from_zone_id) >= 1 AND char_length(from_zone_id) <= 100);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_household_key_check CHECK (char_length(household_key) >= 1 AND char_length(household_key) <= 200);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_payload_hash_check CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'::text);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_pkey PRIMARY KEY (id);

ALTER TABLE public.evaluation_crowd_signal_reviews
  ADD CONSTRAINT evaluation_crowd_signal_reviews_signal_id_fkey FOREIGN KEY (signal_id) REFERENCES public.evaluation_crowd_signals(id) ON DELETE RESTRICT;

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_product_key_check CHECK (char_length(product_key) >= 3 AND char_length(product_key) <= 512);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_product_name_check CHECK (char_length(btrim(product_name)) >= 1 AND char_length(btrim(product_name)) <= 1000);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_raw_payload_check CHECK (jsonb_typeof(raw_payload) = 'object'::text);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_schema_version_check CHECK (schema_version = 1);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_source_check CHECK (source = ANY (ARRAY['alpha_app'::text, 'manual_import'::text]));

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_store_key_check CHECK (store_key IS NULL OR char_length(store_key) >= 1 AND char_length(store_key) <= 200);

ALTER TABLE public.evaluation_crowd_signals
  ADD CONSTRAINT evaluation_crowd_signals_to_zone_check CHECK (char_length(to_zone_id) >= 1 AND char_length(to_zone_id) <= 100);

GRANT INSERT, SELECT ON public.evaluation_crowd_signals TO service_role;

CREATE INDEX evaluation_crowd_signals_product_idx ON public.evaluation_crowd_signals (product_key, received_at DESC);

CREATE INDEX evaluation_crowd_signals_received_idx ON public.evaluation_crowd_signals (received_at DESC, id DESC);

CREATE INDEX evaluation_crowd_signals_store_idx ON public.evaluation_crowd_signals (store_key, received_at DESC)
  WHERE store_key IS NOT NULL;

CREATE POLICY evaluation_server_only ON public.evaluation_crowd_signals
  AS RESTRICTIVE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

ALTER TABLE public.evaluation_labels
  ADD COLUMN expected_product_family_id text;

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_product_family_check
    CHECK
    (expected_product_family_id IS NULL OR (expected_product_family_id = ANY (ARRAY['fruit'::text, 'vegetables'::text, 'herbs'::text, 'potatoes_onions'::text,
    'bread_baked_goods'::text,
    'milk'::text,
    'plant_drink'::text,
    'cream'::text,
    'yogurt'::text,
    'cheese'::text,
    'butter_margarine'::text,
    'eggs'::text,
    'chilled_dessert'::text,
    'tofu_meat_alternative'::text,
    'meat'::text,
    'poultry'::text,
    'fish_seafood'::text,
    'deli_cold_cuts'::text,
    'pasta'::text,
    'rice'::text,
    'grains'::text,
    'legumes'::text,
    'flour_baking'::text,
    'oil_vinegar'::text,
    'spices_seasoning'::text,
    'sugar_sweeteners'::text,
    'tomato_products'::text,
    'pasta_sauce'::text,
    'condiments'::text,
    'canned_food'::text,
    'soup_ready_meal'::text,
    'spreads'::text,
    'breakfast_cereal'::text,
    'savory_snacks'::text,
    'sweets'::text,
    'nuts_dried_fruit'::text,
    'water_soft_drinks'::text,
    'juice'::text,
    'alcoholic_beverages'::text, 'coffee'::text, 'tea'::text, 'baby_food'::text, 'pet_food'::text, 'household_cleaning'::text, 'personal_care'::text, 'other_food'::text])));

ALTER TABLE public.evaluation_labels
  ADD COLUMN expected_product_form_id text;

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_product_form_check
    CHECK
    (expected_product_form_id IS NULL OR (expected_product_form_id = ANY (ARRAY['fresh'::text, 'chilled'::text, 'ambient'::text, 'frozen'::text, 'canned_jarred'::text, 'dry'::text,
    'prepared'::text])));

ALTER TABLE public.evaluation_labels
  ADD COLUMN expected_placement_zone_id text;

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_placement_zone_check
    CHECK
    (expected_placement_zone_id IS NULL OR (expected_placement_zone_id = ANY (ARRAY['fresh_produce'::text, 'bakery'::text, 'chilled_dairy_eggs'::text, 'ambient_milk_drinks'::text,
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
    'cold_drinks'::text, 'hot_drinks'::text, 'alcohol'::text, 'frozen'::text, 'baby'::text, 'pets'::text, 'household'::text, 'personal_care'::text, 'other'::text])));

ALTER TABLE public.evaluation_labels
  ADD COLUMN taxonomy_version_at_label text;

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_taxonomy_complete_check
    CHECK
    (expected_product_family_id IS NULL AND expected_product_form_id IS NULL AND expected_placement_zone_id IS NULL AND taxonomy_version_at_label IS NULL OR status =
    'labeled'::text AND expected_product_family_id IS NOT NULL AND expected_product_form_id IS NOT NULL AND expected_placement_zone_id IS
    NOT NULL AND char_length(btrim(taxonomy_version_at_label)) >= 1 AND char_length(btrim(taxonomy_version_at_label)) <= 100);

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.evaluation_silver_labels FROM anon;

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.evaluation_silver_labels FROM authenticated;