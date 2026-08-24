create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to postgres;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.evaluation_reviewers (
  id bigint generated always as identity primary key,
  slug text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint evaluation_reviewers_slug_format_check
    check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  constraint evaluation_reviewers_display_name_check
    check (char_length(btrim(display_name)) between 1 and 100)
);

create table public.evaluation_labels (
  id bigint generated always as identity primary key,
  reviewer_id bigint not null references public.evaluation_reviewers(id) on delete cascade,
  product_key text not null,
  barcode text,
  product_snapshot_hash text not null,
  product_name text not null,
  brand text,
  quantity text,
  category_tags text[] not null default '{}',
  expected_category_id text,
  status text not null,
  dataset_split text not null,
  note text,
  classifier_version_at_label text not null,
  original_prediction_category_id text,
  original_prediction_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expected_product_family_id text,
  expected_product_form_id text,
  expected_placement_zone_id text,
  taxonomy_version_at_label text,
  constraint evaluation_labels_reviewer_product_key_key unique (reviewer_id, product_key),
  constraint evaluation_labels_product_key_check check (char_length(product_key) between 3 and 512),
  constraint evaluation_labels_snapshot_hash_check check (product_snapshot_hash ~ '^[a-f0-9]{64}$'),
  constraint evaluation_labels_product_name_check check (char_length(btrim(product_name)) between 1 and 1000),
  constraint evaluation_labels_barcode_check check (barcode is null or barcode ~ '^[0-9]{6,32}$'),
  constraint evaluation_labels_status_check check (status in ('labeled', 'ambiguous', 'invalid')),
  constraint evaluation_labels_dataset_split_check check (dataset_split in ('calibration', 'holdout')),
  constraint evaluation_labels_expected_category_check check (
    expected_category_id is null or expected_category_id in (
      'produce', 'bakery', 'convenience', 'breakfast', 'hot_beverages',
      'pantry_staples', 'cooking_baking', 'canned_sauces', 'snacks', 'beverages',
      'drugstore', 'baby_kids', 'household', 'pet_supplies', 'meat_poultry',
      'fish_seafood', 'deli_cold_cuts', 'plant_based', 'dairy_eggs', 'frozen', 'checkout'
    )
  ),
  constraint evaluation_labels_status_value_check check (
    status = 'labeled' or expected_category_id is null
  ),
  constraint evaluation_labels_original_prediction_check check (
    original_prediction_category_id is null or original_prediction_category_id in (
      'produce', 'bakery', 'convenience', 'breakfast', 'hot_beverages',
      'pantry_staples', 'cooking_baking', 'canned_sauces', 'snacks', 'beverages',
      'drugstore', 'baby_kids', 'household', 'pet_supplies', 'meat_poultry',
      'fish_seafood', 'deli_cold_cuts', 'plant_based', 'dairy_eggs', 'frozen', 'checkout'
    )
  ),
  constraint evaluation_labels_original_source_check check (
    original_prediction_source is null or original_prediction_source in ('off_taxonomy', 'name_fallback')
  ),
  constraint evaluation_labels_updated_after_created_check check (updated_at >= created_at),
  constraint evaluation_labels_product_family_check check (
    expected_product_family_id is null or expected_product_family_id in (
      'fruit', 'vegetables', 'herbs', 'potatoes_onions', 'bread_baked_goods',
      'milk', 'plant_drink', 'cream', 'yogurt', 'cheese', 'butter_margarine', 'eggs',
      'chilled_dessert', 'tofu_meat_alternative', 'meat', 'poultry', 'fish_seafood',
      'deli_cold_cuts', 'pasta', 'rice', 'grains', 'legumes', 'flour_baking',
      'oil_vinegar', 'spices_seasoning', 'sugar_sweeteners', 'tomato_products',
      'pasta_sauce', 'condiments', 'canned_food', 'soup_ready_meal', 'spreads',
      'breakfast_cereal', 'savory_snacks', 'sweets', 'nuts_dried_fruit',
      'water_soft_drinks', 'juice', 'alcoholic_beverages', 'coffee', 'tea',
      'baby_food', 'pet_food', 'household_cleaning', 'personal_care', 'other_food'
    )
  ),
  constraint evaluation_labels_product_form_check check (
    expected_product_form_id is null or expected_product_form_id in (
      'fresh', 'chilled', 'ambient', 'frozen', 'canned_jarred', 'dry', 'prepared'
    )
  ),
  constraint evaluation_labels_placement_zone_check check (
    expected_placement_zone_id is null or expected_placement_zone_id in (
      'fresh_produce', 'bakery', 'chilled_dairy_eggs', 'ambient_milk_drinks',
      'chilled_plant_based', 'meat_poultry', 'fish_seafood', 'deli', 'pasta_tomato',
      'rice_world_foods', 'breakfast', 'baking', 'oils_spices', 'condiments',
      'canned_jars', 'ready_meals', 'snacks', 'sweets', 'cold_drinks', 'hot_drinks',
      'alcohol', 'frozen', 'baby', 'pets', 'household', 'personal_care', 'other'
    )
  ),
  constraint evaluation_labels_taxonomy_complete_check check (
    (
      expected_product_family_id is null
      and expected_product_form_id is null
      and expected_placement_zone_id is null
      and taxonomy_version_at_label is null
    ) or (
      status = 'labeled'
      and expected_product_family_id is not null
      and expected_product_form_id is not null
      and expected_placement_zone_id is not null
      and char_length(btrim(taxonomy_version_at_label)) >= 1
      and char_length(btrim(taxonomy_version_at_label)) <= 100
    )
  )
);

create index evaluation_labels_reviewer_split_status_idx
  on public.evaluation_labels (reviewer_id, dataset_split, status, updated_at desc);

create index evaluation_labels_active_barcode_idx
  on public.evaluation_labels (barcode)
  where barcode is not null;

create table public.evaluation_silver_labels (
  id bigint generated always as identity primary key,
  reviewer_id bigint not null references public.evaluation_reviewers(id) on delete cascade,
  product_key text not null,
  barcode text,
  product_snapshot_hash text not null,
  product_name text not null,
  brand text,
  quantity text,
  category_tags text[] not null default '{}',
  dataset_split text not null,
  proposed_category_id text,
  alternative_category_id text,
  annotation_status text not null,
  review_status text not null default 'pending',
  model_provider text not null,
  model_name text not null,
  prompt_version text not null,
  prompt_fingerprint text not null,
  rationale text,
  evidence text[] not null default '{}',
  raw_response jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_silver_labels_reviewer_product_model_prompt_key
    unique (reviewer_id, product_key, model_provider, model_name, prompt_version),
  constraint evaluation_silver_labels_product_key_check check (char_length(product_key) between 3 and 512),
  constraint evaluation_silver_labels_snapshot_hash_check check (product_snapshot_hash ~ '^[a-f0-9]{64}$'),
  constraint evaluation_silver_labels_product_name_check check (char_length(btrim(product_name)) between 1 and 1000),
  constraint evaluation_silver_labels_barcode_check check (barcode is null or barcode ~ '^[0-9]{6,32}$'),
  constraint evaluation_silver_labels_dataset_split_check check (dataset_split in ('calibration', 'holdout')),
  constraint evaluation_silver_labels_proposed_category_check check (
    proposed_category_id is null or proposed_category_id in (
      'produce', 'bakery', 'convenience', 'breakfast', 'hot_beverages',
      'pantry_staples', 'cooking_baking', 'canned_sauces', 'snacks', 'beverages',
      'drugstore', 'baby_kids', 'household', 'pet_supplies', 'meat_poultry',
      'fish_seafood', 'deli_cold_cuts', 'plant_based', 'dairy_eggs', 'frozen', 'checkout'
    )
  ),
  constraint evaluation_silver_labels_alternative_category_check check (
    alternative_category_id is null or alternative_category_id in (
      'produce', 'bakery', 'convenience', 'breakfast', 'hot_beverages',
      'pantry_staples', 'cooking_baking', 'canned_sauces', 'snacks', 'beverages',
      'drugstore', 'baby_kids', 'household', 'pet_supplies', 'meat_poultry',
      'fish_seafood', 'deli_cold_cuts', 'plant_based', 'dairy_eggs', 'frozen', 'checkout'
    )
  ),
  constraint evaluation_silver_labels_distinct_alternative_check
    check (alternative_category_id is null or alternative_category_id is distinct from proposed_category_id),
  constraint evaluation_silver_labels_annotation_status_check
    check (annotation_status in ('labeled', 'abstained', 'invalid')),
  constraint evaluation_silver_labels_review_status_check
    check (review_status in ('pending', 'accepted', 'rejected')),
  constraint evaluation_silver_labels_status_value_check check (
    (annotation_status = 'labeled' and proposed_category_id is not null)
    or (annotation_status <> 'labeled' and proposed_category_id is null)
  ),
  constraint evaluation_silver_labels_model_provider_check check (char_length(btrim(model_provider)) between 1 and 50),
  constraint evaluation_silver_labels_model_name_check check (char_length(btrim(model_name)) between 1 and 100),
  constraint evaluation_silver_labels_prompt_version_check check (char_length(btrim(prompt_version)) between 1 and 100),
  constraint evaluation_silver_labels_prompt_fingerprint_check check (prompt_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint evaluation_silver_labels_raw_response_object_check check (jsonb_typeof(raw_response) = 'object'),
  constraint evaluation_silver_labels_updated_after_created_check check (updated_at >= created_at)
);

create index evaluation_silver_labels_reviewer_review_idx
  on public.evaluation_silver_labels (reviewer_id, review_status, updated_at desc, id desc);

create index evaluation_silver_labels_reviewer_product_idx
  on public.evaluation_silver_labels (reviewer_id, product_key, updated_at desc);

create or replace function private.set_evaluation_label_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_evaluation_label_updated_at() from public, anon, authenticated;
grant execute on function private.set_evaluation_label_updated_at() to service_role;

create trigger set_evaluation_label_updated_at
before insert or update on public.evaluation_labels
for each row execute function private.set_evaluation_label_updated_at();

create trigger set_evaluation_silver_label_updated_at
before insert or update on public.evaluation_silver_labels
for each row execute function private.set_evaluation_label_updated_at();

create table public.evaluation_runs (
  id bigint generated always as identity primary key,
  reviewer_id bigint not null references public.evaluation_reviewers(id) on delete cascade,
  classifier_version text not null,
  classifier_fingerprint text not null,
  dump_fingerprint text not null,
  dump_product_count bigint not null,
  label_count bigint not null,
  metrics jsonb not null,
  created_at timestamptz not null default now(),
  constraint evaluation_runs_classifier_version_check check (char_length(classifier_version) between 1 and 100),
  constraint evaluation_runs_classifier_fingerprint_check check (classifier_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint evaluation_runs_dump_fingerprint_check check (dump_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint evaluation_runs_dump_product_count_check check (dump_product_count >= 0),
  constraint evaluation_runs_label_count_check check (label_count >= 0),
  constraint evaluation_runs_metrics_object_check check (jsonb_typeof(metrics) = 'object')
);

create index evaluation_runs_reviewer_created_idx
  on public.evaluation_runs (reviewer_id, created_at desc, id desc);

create table public.evaluation_run_predictions (
  run_id bigint not null references public.evaluation_runs(id) on delete cascade,
  label_id bigint not null references public.evaluation_labels(id) on delete cascade,
  predicted_category_id text,
  prediction_source text,
  conflict_reason text,
  trace jsonb not null,
  primary key (run_id, label_id),
  constraint evaluation_run_predictions_category_check check (
    predicted_category_id is null or predicted_category_id in (
      'produce', 'bakery', 'convenience', 'breakfast', 'hot_beverages',
      'pantry_staples', 'cooking_baking', 'canned_sauces', 'snacks', 'beverages',
      'drugstore', 'baby_kids', 'household', 'pet_supplies', 'meat_poultry',
      'fish_seafood', 'deli_cold_cuts', 'plant_based', 'dairy_eggs', 'frozen', 'checkout'
    )
  ),
  constraint evaluation_run_predictions_source_check check (
    prediction_source is null or prediction_source in ('off_taxonomy', 'name_fallback')
  ),
  constraint evaluation_run_predictions_trace_object_check check (jsonb_typeof(trace) = 'object')
);

create index evaluation_run_predictions_label_idx
  on public.evaluation_run_predictions (label_id, run_id desc);

create table public.evaluation_crowd_signals (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  schema_version integer not null,
  source text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  actor_key text not null,
  household_key text not null,
  store_key text,
  product_key text not null,
  barcode text,
  product_name text not null,
  from_zone_id text,
  to_zone_id text not null,
  classifier_version text not null,
  payload_sha256 text not null,
  raw_payload jsonb not null,
  constraint evaluation_crowd_signals_schema_version_check check (schema_version = 1),
  constraint evaluation_crowd_signals_source_check check (source in ('alpha_app', 'manual_import')),
  constraint evaluation_crowd_signals_event_type_check check (event_type = 'product_moved'),
  constraint evaluation_crowd_signals_event_id_check check (char_length(event_id) between 1 and 200),
  constraint evaluation_crowd_signals_actor_key_check check (char_length(actor_key) between 1 and 200),
  constraint evaluation_crowd_signals_household_key_check check (char_length(household_key) between 1 and 200),
  constraint evaluation_crowd_signals_store_key_check check (store_key is null or char_length(store_key) between 1 and 200),
  constraint evaluation_crowd_signals_product_key_check check (char_length(product_key) between 3 and 512),
  constraint evaluation_crowd_signals_barcode_check check (barcode is null or barcode ~ '^[0-9]{6,32}$'),
  constraint evaluation_crowd_signals_product_name_check check (char_length(btrim(product_name)) between 1 and 1000),
  constraint evaluation_crowd_signals_from_zone_check check (from_zone_id is null or char_length(from_zone_id) between 1 and 100),
  constraint evaluation_crowd_signals_to_zone_check check (char_length(to_zone_id) between 1 and 100),
  constraint evaluation_crowd_signals_classifier_version_check check (char_length(classifier_version) between 1 and 100),
  constraint evaluation_crowd_signals_payload_hash_check check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  constraint evaluation_crowd_signals_raw_payload_check check (jsonb_typeof(raw_payload) = 'object')
);

create index evaluation_crowd_signals_received_idx
  on public.evaluation_crowd_signals (received_at desc, id desc);

create index evaluation_crowd_signals_product_idx
  on public.evaluation_crowd_signals (product_key, received_at desc);

create index evaluation_crowd_signals_store_idx
  on public.evaluation_crowd_signals (store_key, received_at desc)
  where store_key is not null;

create table public.evaluation_crowd_signal_reviews (
  id bigint generated always as identity primary key,
  signal_id bigint not null references public.evaluation_crowd_signals(id) on delete restrict,
  reviewer_id bigint not null references public.evaluation_reviewers(id) on delete restrict,
  decision text not null,
  product_family_id text,
  product_form_id text,
  placement_zone_id text,
  training_approved boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  constraint evaluation_crowd_signal_reviews_decision_check check (
    decision in ('confirmed', 'rejected', 'duplicate', 'insufficient_context')
  ),
  constraint evaluation_crowd_signal_reviews_family_check check (
    product_family_id is null or product_family_id in (
      'fruit', 'vegetables', 'herbs', 'potatoes_onions', 'bread_baked_goods',
      'milk', 'plant_drink', 'cream', 'yogurt', 'cheese', 'butter_margarine', 'eggs',
      'chilled_dessert', 'tofu_meat_alternative', 'meat', 'poultry', 'fish_seafood',
      'deli_cold_cuts', 'pasta', 'rice', 'grains', 'legumes', 'flour_baking',
      'oil_vinegar', 'spices_seasoning', 'sugar_sweeteners', 'tomato_products',
      'pasta_sauce', 'condiments', 'canned_food', 'soup_ready_meal', 'spreads',
      'breakfast_cereal', 'savory_snacks', 'sweets', 'nuts_dried_fruit',
      'water_soft_drinks', 'juice', 'alcoholic_beverages', 'coffee', 'tea',
      'baby_food', 'pet_food', 'household_cleaning', 'personal_care', 'other_food'
    )
  ),
  constraint evaluation_crowd_signal_reviews_form_check check (
    product_form_id is null or product_form_id in (
      'fresh', 'chilled', 'ambient', 'frozen', 'canned_jarred', 'dry', 'prepared'
    )
  ),
  constraint evaluation_crowd_signal_reviews_zone_check check (
    placement_zone_id is null or placement_zone_id in (
      'fresh_produce', 'bakery', 'chilled_dairy_eggs', 'ambient_milk_drinks',
      'chilled_plant_based', 'meat_poultry', 'fish_seafood', 'deli', 'pasta_tomato',
      'rice_world_foods', 'breakfast', 'baking', 'oils_spices', 'condiments',
      'canned_jars', 'ready_meals', 'snacks', 'sweets', 'cold_drinks', 'hot_drinks',
      'alcohol', 'frozen', 'baby', 'pets', 'household', 'personal_care', 'other'
    )
  ),
  constraint evaluation_crowd_signal_reviews_complete_check check (
    (
      decision = 'confirmed'
      and product_family_id is not null
      and product_form_id is not null
      and placement_zone_id is not null
    ) or (
      decision <> 'confirmed'
      and product_family_id is null
      and product_form_id is null
      and placement_zone_id is null
      and training_approved = false
    )
  ),
  constraint evaluation_crowd_signal_reviews_training_check check (
    training_approved = false or decision = 'confirmed'
  ),
  constraint evaluation_crowd_signal_reviews_note_check check (note is null or char_length(note) <= 2000)
);

create index evaluation_crowd_signal_reviews_signal_idx
  on public.evaluation_crowd_signal_reviews (signal_id, created_at desc, id desc);

create index evaluation_crowd_signal_reviews_training_idx
  on public.evaluation_crowd_signal_reviews (training_approved, created_at desc)
  where training_approved = true;

alter table public.evaluation_reviewers enable row level security;
alter table public.evaluation_labels enable row level security;
alter table public.evaluation_silver_labels enable row level security;
alter table public.evaluation_runs enable row level security;
alter table public.evaluation_run_predictions enable row level security;
alter table public.evaluation_crowd_signals enable row level security;
alter table public.evaluation_crowd_signal_reviews enable row level security;

create policy evaluation_server_only on public.evaluation_reviewers
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy evaluation_server_only on public.evaluation_labels
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy evaluation_server_only on public.evaluation_silver_labels
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy evaluation_server_only on public.evaluation_runs
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy evaluation_server_only on public.evaluation_run_predictions
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy evaluation_server_only on public.evaluation_crowd_signals
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy evaluation_server_only on public.evaluation_crowd_signal_reviews
  as restrictive for all to anon, authenticated using (false) with check (false);

revoke all on table public.evaluation_reviewers from anon, authenticated;
revoke all on table public.evaluation_labels from anon, authenticated;
revoke all on table public.evaluation_silver_labels from anon, authenticated;
revoke all on table public.evaluation_runs from anon, authenticated;
revoke all on table public.evaluation_run_predictions from anon, authenticated;
revoke all on table public.evaluation_crowd_signals from anon, authenticated;
revoke all on table public.evaluation_crowd_signal_reviews from anon, authenticated;
revoke all on table public.evaluation_crowd_signals from service_role;
revoke all on table public.evaluation_crowd_signal_reviews from service_role;

grant select, insert, update, delete on table public.evaluation_reviewers to service_role;
grant select, insert, update, delete on table public.evaluation_labels to service_role;
grant select, insert, update, delete on table public.evaluation_silver_labels to service_role;
grant select, insert, update, delete on table public.evaluation_runs to service_role;
grant select, insert, update, delete on table public.evaluation_run_predictions to service_role;
grant select, insert on table public.evaluation_crowd_signals to service_role;
grant select, insert on table public.evaluation_crowd_signal_reviews to service_role;

revoke all on sequence public.evaluation_reviewers_id_seq from anon, authenticated;
revoke all on sequence public.evaluation_labels_id_seq from anon, authenticated;
revoke all on sequence public.evaluation_silver_labels_id_seq from anon, authenticated;
revoke all on sequence public.evaluation_runs_id_seq from anon, authenticated;
revoke all on sequence public.evaluation_crowd_signals_id_seq from anon, authenticated;
revoke all on sequence public.evaluation_crowd_signal_reviews_id_seq from anon, authenticated;

grant usage, select on sequence public.evaluation_reviewers_id_seq to service_role;
grant usage, select on sequence public.evaluation_labels_id_seq to service_role;
grant usage, select on sequence public.evaluation_silver_labels_id_seq to service_role;
grant usage, select on sequence public.evaluation_runs_id_seq to service_role;
grant usage, select on sequence public.evaluation_crowd_signals_id_seq to service_role;
grant usage, select on sequence public.evaluation_crowd_signal_reviews_id_seq to service_role;
