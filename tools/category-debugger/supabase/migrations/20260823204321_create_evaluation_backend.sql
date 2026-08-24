-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.evaluation_labels (
  id                              bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  reviewer_id                     bigint                   NOT NULL,
  product_key                     text                     NOT NULL,
  barcode                         text,
  product_snapshot_hash           text                     NOT NULL,
  product_name                    text                     NOT NULL,
  brand                           text,
  quantity                        text,
  category_tags                   text[]                   DEFAULT '{}'::text[] NOT NULL,
  expected_category_id            text,
  status                          text                     NOT NULL,
  dataset_split                   text                     NOT NULL,
  note                            text,
  classifier_version_at_label     text                     NOT NULL,
  original_prediction_category_id text,
  original_prediction_source      text,
  created_at                      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at                      timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.evaluation_labels
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_barcode_check CHECK (barcode IS NULL OR barcode ~ '^[0-9]{6,32}$'::text);

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_dataset_split_check CHECK (dataset_split = ANY (ARRAY['calibration'::text, 'holdout'::text]));

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_expected_category_check
    CHECK
    (expected_category_id IS NULL OR (expected_category_id = ANY (ARRAY['produce'::text, 'bakery'::text, 'convenience'::text, 'breakfast'::text, 'hot_beverages'::text,
    'pantry_staples'::text,
    'cooking_baking'::text,
    'canned_sauces'::text,
    'snacks'::text,
    'beverages'::text,
    'drugstore'::text,
    'baby_kids'::text,
    'household'::text,
    'pet_supplies'::text, 'meat_poultry'::text, 'fish_seafood'::text, 'deli_cold_cuts'::text, 'plant_based'::text, 'dairy_eggs'::text, 'frozen'::text, 'checkout'::text])));

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_original_prediction_check
    CHECK
    (original_prediction_category_id IS NULL OR (original_prediction_category_id = ANY (ARRAY['produce'::text, 'bakery'::text, 'convenience'::text, 'breakfast'::text,
    'hot_beverages'::text,
    'pantry_staples'::text,
    'cooking_baking'::text,
    'canned_sauces'::text,
    'snacks'::text,
    'beverages'::text,
    'drugstore'::text,
    'baby_kids'::text,
    'household'::text,
    'pet_supplies'::text, 'meat_poultry'::text, 'fish_seafood'::text, 'deli_cold_cuts'::text, 'plant_based'::text, 'dairy_eggs'::text, 'frozen'::text, 'checkout'::text])));

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_original_source_check
    CHECK (original_prediction_source IS NULL OR (original_prediction_source = ANY (ARRAY['off_taxonomy'::text, 'name_fallback'::text])));

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_pkey PRIMARY KEY (id);

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_product_key_check CHECK (char_length(product_key) >= 3 AND char_length(product_key) <= 512);

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_product_name_check CHECK (char_length(btrim(product_name)) >= 1 AND char_length(btrim(product_name)) <= 1000);

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_reviewer_product_key_key UNIQUE (reviewer_id, product_key);

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_snapshot_hash_check CHECK (product_snapshot_hash ~ '^[a-f0-9]{64}$'::text);

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_status_check CHECK (status = ANY (ARRAY['labeled'::text, 'ambiguous'::text, 'invalid'::text]));

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_status_value_check CHECK (status = 'labeled'::text OR expected_category_id IS NULL);

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_updated_after_created_check CHECK (updated_at >= created_at);

GRANT ALL ON public.evaluation_labels TO service_role;

CREATE INDEX evaluation_labels_active_barcode_idx ON public.evaluation_labels (barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX evaluation_labels_reviewer_split_status_idx ON public.evaluation_labels (reviewer_id, dataset_split, status, updated_at DESC);

CREATE TABLE public.evaluation_reviewers (
  id           bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  slug         text                     NOT NULL,
  display_name text                     NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.evaluation_reviewers
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.evaluation_reviewers
  ADD CONSTRAINT evaluation_reviewers_display_name_check CHECK (char_length(btrim(display_name)) >= 1 AND char_length(btrim(display_name)) <= 100);

ALTER TABLE public.evaluation_reviewers
  ADD CONSTRAINT evaluation_reviewers_pkey PRIMARY KEY (id);

ALTER TABLE public.evaluation_labels
  ADD CONSTRAINT evaluation_labels_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.evaluation_reviewers(id) ON DELETE CASCADE;

ALTER TABLE public.evaluation_reviewers
  ADD CONSTRAINT evaluation_reviewers_slug_format_check CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'::text);

ALTER TABLE public.evaluation_reviewers
  ADD CONSTRAINT evaluation_reviewers_slug_key UNIQUE (slug);

GRANT ALL ON public.evaluation_reviewers TO service_role;

CREATE TABLE public.evaluation_run_predictions (
  run_id                bigint NOT NULL,
  label_id              bigint NOT NULL,
  predicted_category_id text,
  prediction_source     text,
  conflict_reason       text,
  trace                 jsonb  NOT NULL
);

ALTER TABLE public.evaluation_run_predictions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.evaluation_run_predictions
  ADD CONSTRAINT evaluation_run_predictions_category_check
    CHECK
    (predicted_category_id IS NULL OR (predicted_category_id = ANY (ARRAY['produce'::text, 'bakery'::text, 'convenience'::text, 'breakfast'::text, 'hot_beverages'::text,
    'pantry_staples'::text,
    'cooking_baking'::text,
    'canned_sauces'::text,
    'snacks'::text,
    'beverages'::text,
    'drugstore'::text,
    'baby_kids'::text,
    'household'::text,
    'pet_supplies'::text, 'meat_poultry'::text, 'fish_seafood'::text, 'deli_cold_cuts'::text, 'plant_based'::text, 'dairy_eggs'::text, 'frozen'::text, 'checkout'::text])));

ALTER TABLE public.evaluation_run_predictions
  ADD CONSTRAINT evaluation_run_predictions_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.evaluation_labels(id) ON DELETE CASCADE;

ALTER TABLE public.evaluation_run_predictions
  ADD CONSTRAINT evaluation_run_predictions_pkey PRIMARY KEY (run_id, label_id);

ALTER TABLE public.evaluation_run_predictions
  ADD CONSTRAINT evaluation_run_predictions_source_check CHECK (prediction_source IS NULL OR (prediction_source = ANY (ARRAY['off_taxonomy'::text, 'name_fallback'::text])));

ALTER TABLE public.evaluation_run_predictions
  ADD CONSTRAINT evaluation_run_predictions_trace_object_check CHECK (jsonb_typeof(trace) = 'object'::text);

GRANT ALL ON public.evaluation_run_predictions TO service_role;

CREATE INDEX evaluation_run_predictions_label_idx ON public.evaluation_run_predictions (label_id, run_id DESC);

CREATE TABLE public.evaluation_runs (
  id                     bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  reviewer_id            bigint                   NOT NULL,
  classifier_version     text                     NOT NULL,
  classifier_fingerprint text                     NOT NULL,
  dump_fingerprint       text                     NOT NULL,
  dump_product_count     bigint                   NOT NULL,
  label_count            bigint                   NOT NULL,
  metrics                jsonb                    NOT NULL,
  created_at             timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.evaluation_runs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.evaluation_runs
  ADD CONSTRAINT evaluation_runs_classifier_fingerprint_check CHECK (classifier_fingerprint ~ '^[a-f0-9]{64}$'::text);

ALTER TABLE public.evaluation_runs
  ADD CONSTRAINT evaluation_runs_classifier_version_check CHECK (char_length(classifier_version) >= 1 AND char_length(classifier_version) <= 100);

ALTER TABLE public.evaluation_runs
  ADD CONSTRAINT evaluation_runs_dump_fingerprint_check CHECK (dump_fingerprint ~ '^[a-f0-9]{64}$'::text);

ALTER TABLE public.evaluation_runs
  ADD CONSTRAINT evaluation_runs_dump_product_count_check CHECK (dump_product_count >= 0);

ALTER TABLE public.evaluation_runs
  ADD CONSTRAINT evaluation_runs_label_count_check CHECK (label_count >= 0);

ALTER TABLE public.evaluation_runs
  ADD CONSTRAINT evaluation_runs_metrics_object_check CHECK (jsonb_typeof(metrics) = 'object'::text);

ALTER TABLE public.evaluation_runs
  ADD CONSTRAINT evaluation_runs_pkey PRIMARY KEY (id);

ALTER TABLE public.evaluation_run_predictions
  ADD CONSTRAINT evaluation_run_predictions_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.evaluation_runs(id) ON DELETE CASCADE;

ALTER TABLE public.evaluation_runs
  ADD CONSTRAINT evaluation_runs_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.evaluation_reviewers(id) ON DELETE CASCADE;

GRANT ALL ON public.evaluation_runs TO service_role;

CREATE INDEX evaluation_runs_reviewer_created_idx ON public.evaluation_runs (reviewer_id, created_at DESC, id DESC);