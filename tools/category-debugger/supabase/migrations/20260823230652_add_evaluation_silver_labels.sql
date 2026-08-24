-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.evaluation_silver_labels (
  id                      bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  reviewer_id             bigint                   NOT NULL,
  product_key             text                     NOT NULL,
  barcode                 text,
  product_snapshot_hash   text                     NOT NULL,
  product_name            text                     NOT NULL,
  brand                   text,
  quantity                text,
  category_tags           text[]                   DEFAULT '{}'::text[] NOT NULL,
  dataset_split           text                     NOT NULL,
  proposed_category_id    text,
  alternative_category_id text,
  annotation_status       text                     NOT NULL,
  review_status           text                     DEFAULT 'pending'::text NOT NULL,
  model_provider          text                     NOT NULL,
  model_name              text                     NOT NULL,
  prompt_version          text                     NOT NULL,
  prompt_fingerprint      text                     NOT NULL,
  rationale               text,
  evidence                text[]                   DEFAULT '{}'::text[] NOT NULL,
  raw_response            jsonb                    NOT NULL,
  created_at              timestamp with time zone DEFAULT now() NOT NULL,
  updated_at              timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.evaluation_silver_labels
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_alternative_category_check
    CHECK
    (alternative_category_id IS NULL OR (alternative_category_id = ANY (ARRAY['produce'::text, 'bakery'::text, 'convenience'::text, 'breakfast'::text, 'hot_beverages'::text,
    'pantry_staples'::text,
    'cooking_baking'::text,
    'canned_sauces'::text,
    'snacks'::text,
    'beverages'::text,
    'drugstore'::text,
    'baby_kids'::text,
    'household'::text,
    'pet_supplies'::text, 'meat_poultry'::text, 'fish_seafood'::text, 'deli_cold_cuts'::text, 'plant_based'::text, 'dairy_eggs'::text, 'frozen'::text, 'checkout'::text])));

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_annotation_status_check CHECK (annotation_status = ANY (ARRAY['labeled'::text, 'abstained'::text, 'invalid'::text]));

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_barcode_check CHECK (barcode IS NULL OR barcode ~ '^[0-9]{6,32}$'::text);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_dataset_split_check CHECK (dataset_split = ANY (ARRAY['calibration'::text, 'holdout'::text]));

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_distinct_alternative_check CHECK (alternative_category_id IS NULL OR alternative_category_id IS DISTINCT FROM proposed_category_id);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_model_name_check CHECK (char_length(btrim(model_name)) >= 1 AND char_length(btrim(model_name)) <= 100);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_model_provider_check CHECK (char_length(btrim(model_provider)) >= 1 AND char_length(btrim(model_provider)) <= 50);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_pkey PRIMARY KEY (id);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_product_key_check CHECK (char_length(product_key) >= 3 AND char_length(product_key) <= 512);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_product_name_check CHECK (char_length(btrim(product_name)) >= 1 AND char_length(btrim(product_name)) <= 1000);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_prompt_fingerprint_check CHECK (prompt_fingerprint ~ '^[a-f0-9]{64}$'::text);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_prompt_version_check CHECK (char_length(btrim(prompt_version)) >= 1 AND char_length(btrim(prompt_version)) <= 100);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_proposed_category_check
    CHECK
    (proposed_category_id IS NULL OR (proposed_category_id = ANY (ARRAY['produce'::text, 'bakery'::text, 'convenience'::text, 'breakfast'::text, 'hot_beverages'::text,
    'pantry_staples'::text,
    'cooking_baking'::text,
    'canned_sauces'::text,
    'snacks'::text,
    'beverages'::text,
    'drugstore'::text,
    'baby_kids'::text,
    'household'::text,
    'pet_supplies'::text, 'meat_poultry'::text, 'fish_seafood'::text, 'deli_cold_cuts'::text, 'plant_based'::text, 'dairy_eggs'::text, 'frozen'::text, 'checkout'::text])));

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_raw_response_object_check CHECK (jsonb_typeof(raw_response) = 'object'::text);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_review_status_check CHECK (review_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text]));

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.evaluation_reviewers(id) ON DELETE CASCADE;

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_reviewer_product_model_prompt_key UNIQUE (reviewer_id, product_key, model_provider, model_name, prompt_version);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_snapshot_hash_check CHECK (product_snapshot_hash ~ '^[a-f0-9]{64}$'::text);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_status_value_check CHECK (annotation_status = 'labeled'::text AND proposed_category_id IS
    NOT NULL OR annotation_status <> 'labeled'::text AND proposed_category_id IS NULL);

ALTER TABLE public.evaluation_silver_labels
  ADD CONSTRAINT evaluation_silver_labels_updated_after_created_check CHECK (updated_at >= created_at);

GRANT ALL ON public.evaluation_silver_labels TO service_role;

CREATE INDEX evaluation_silver_labels_reviewer_review_idx ON public.evaluation_silver_labels (reviewer_id, review_status, updated_at DESC, id DESC);

CREATE INDEX evaluation_silver_labels_reviewer_product_idx ON public.evaluation_silver_labels (reviewer_id, product_key, updated_at DESC);

CREATE TRIGGER set_evaluation_silver_label_updated_at
  BEFORE INSERT OR UPDATE ON public.evaluation_silver_labels
  FOR EACH ROW
  EXECUTE FUNCTION private.set_evaluation_label_updated_at();

CREATE POLICY evaluation_server_only ON public.evaluation_silver_labels
  AS RESTRICTIVE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);