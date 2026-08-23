import type { Migration } from '@/lib/db/types';

/**
 * Vorwaertsgerichtetes lokales Schema. Zeitstempel sind Epoch-Millisekunden,
 * `_dirty` markiert ungepushte Zeilen und Fremdschluessel bleiben dem Server
 * ueberlassen, weil Tabellen unabhaengig gepullt werden.
 */

const V1_MIRRORS = `
create table if not exists storage_locations (
  id           text primary key not null,
  household_id text not null,
  name         text not null,
  kind         text not null,
  sort_order   integer not null default 0,
  created_at   text,
  updated_at   integer not null,
  deleted_at   integer,
  _dirty       integer not null default 0
);
create index if not exists storage_locations_hh_idx on storage_locations (household_id, sort_order);
create index if not exists storage_locations_dirty_idx on storage_locations (_dirty) where _dirty = 1;

create table if not exists fridge_items (
  id           text primary key not null,
  household_id text not null,
  location_id  text,
  product_id   text,
  name         text not null,
  quantity     real not null default 1,
  unit         text not null default 'piece',
  expiry_date  text,
  added_by     text,
  created_at   text,
  updated_at   integer not null,
  deleted_at   integer,
  _dirty       integer not null default 0
);
create index if not exists fridge_items_hh_idx on fridge_items (household_id, deleted_at);
create index if not exists fridge_items_loc_idx on fridge_items (location_id);
create index if not exists fridge_items_dirty_idx on fridge_items (_dirty) where _dirty = 1;

create table if not exists shopping_list_items (
  id           text primary key not null,
  household_id text not null,
  product_id   text,
  name         text not null,
  quantity     real not null default 1,
  unit         text not null default 'piece',
  category_id  text check (category_id in (
    'produce','bakery','deli_meat','pantry_canned','pantry_dry','breakfast',
    'snacks','beverages','dairy','frozen','drugstore','checkout'
  )),
  category_source text check (category_source in (
    'user','household_preference','off_taxonomy','name_fallback'
  )),
  category_classifier_version text check (
    category_classifier_version is null
    or length(trim(category_classifier_version)) between 1 and 100
  ),
  sort_index   integer not null default 0,
  checked_at   text,
  checked_by   text,
  added_by     text,
  created_at   text,
  updated_at   integer not null,
  deleted_at   integer,
  _dirty       integer not null default 0
);
create index if not exists shopping_list_items_hh_idx on shopping_list_items (household_id, deleted_at);
create index if not exists shopping_list_items_dirty_idx on shopping_list_items (_dirty) where _dirty = 1;

create table if not exists products (
  id                text primary key not null,
  barcode           text,
  name              text not null,
  brand             text,
  kcal_per_100      real,
  protein_g_per_100 real,
  carbs_g_per_100   real,
  fat_g_per_100     real,
  fiber_g_per_100   real,
  sugar_g_per_100   real,
  salt_g_per_100    real,
  serving_size_g    real,
  off_category_tags text not null default '[]',
  off_last_modified_at text,
  source            text not null default 'manual',
  created_by        text,
  created_at        text,
  updated_at        integer not null,
  deleted_at        integer,
  _dirty            integer not null default 0
);
create index if not exists products_barcode_idx on products (barcode);

create table if not exists shopping_category_preferences (
  id                   text primary key not null,
  household_id         text not null,
  key_type              text not null check (key_type in ('product','name')),
  normalized_key_value text not null check (
    length(normalized_key_value) between 1 and 500
    and normalized_key_value = lower(trim(normalized_key_value))
  ),
  category_id           text check (category_id in (
    'produce','bakery','deli_meat','pantry_canned','pantry_dry','breakfast',
    'snacks','beverages','dairy','frozen','drugstore','checkout'
  )),
  created_by            text,
  created_at            text,
  updated_at            integer not null,
  deleted_at            integer,
  _dirty                integer not null default 0,
  unique (household_id, key_type, normalized_key_value)
);
create index if not exists shopping_category_preferences_hh_idx
  on shopping_category_preferences (household_id, updated_at, id);
create index if not exists shopping_category_preferences_dirty_idx
  on shopping_category_preferences (_dirty) where _dirty = 1;
`;

// `products.deleted_at` vereinheitlicht nur die lokale Spiegelform.

const V1_OUTBOX = `
create table if not exists outbox (
  id              integer primary key autoincrement,
  entity          text    not null,
  entity_id       text    not null,
  op              text    not null check (op in ('insert','update','delete')),
  payload         text    not null,
  created_at      integer not null,
  attempts        integer not null default 0,
  last_error      text,
  next_attempt_at integer not null default 0
);
create index if not exists outbox_row_idx on outbox (entity, entity_id, id);
create index if not exists outbox_due_idx on outbox (next_attempt_at, id);
`;

// AUTOINCREMENT bewahrt die Outbox-Reihenfolge auch nach geloeschten Eintraegen.
// `next_attempt_at` persistiert Retry-Backoff ueber App-Neustarts hinweg.

const V1_STATE = `
create table if not exists sync_state (
  entity         text not null,
  scope          text not null default 'default',
  last_synced_at text,
  last_synced_id text,
  last_run_at    integer,
  last_error     text,
  primary key (entity, scope)
);

create table if not exists app_meta (
  key   text primary key not null,
  value text
);
`;

// Der Pull-Cursor bleibt als roher Server-String erhalten, damit keine Praezision verloren geht.
const V2_SHOPPING_HISTORY = `
create table if not exists shopping_history (
  id            text primary key not null,
  household_id  text not null,
  completed_by  text,
  completed_at  text not null,
  item_name     text not null,
  quantity      real not null,
  unit          text not null,
  category_id   text check (category_id in (
    'produce','bakery','deli_meat','pantry_canned','pantry_dry','breakfast',
    'snacks','beverages','dairy','frozen','drugstore','checkout'
  )),
  category_source text check (category_source in (
    'user','household_preference','off_taxonomy','name_fallback'
  )),
  category_classifier_version text check (
    category_classifier_version is null
    or length(trim(category_classifier_version)) between 1 and 100
  ),
  product_id    text,
  location_kind text,
  expiry_date   text,
  created_at    text not null
);
create index if not exists shopping_history_hh_idx on shopping_history (household_id, completed_at);
`;

const V3_STORES = `
create table if not exists stores (
  id           text primary key not null,
  household_id text not null,
  name         text not null,
  color        text not null,
  sort_order   integer not null default 0,
  created_at   text,
  updated_at   integer not null,
  deleted_at   integer,
  _dirty       integer not null default 0
);
create index if not exists stores_hh_idx on stores (household_id, sort_order);
create index if not exists stores_dirty_idx on stores (_dirty) where _dirty = 1;

alter table shopping_list_items add column store_id text;
alter table shopping_list_items add column price_estimate real;
create index if not exists shopping_list_items_store_idx on shopping_list_items (store_id);
`;

const V4_STORES_REVERSE_ORDER = `
alter table stores add column reverse_order integer not null default 0;
`;

const V5_STORE_CATEGORY_ORDER = `
alter table stores drop column reverse_order;
alter table stores add column category_order text;
`;

// Haushalte sind Pull-only; `_dirty` und `deleted_at` vereinheitlichen nur die Spiegelform.
const V6_HOUSEHOLDS = `
create table if not exists households (
  id         text primary key not null,
  name       text not null,
  created_by text,
  created_at text,
  updated_at integer not null,
  deleted_at integer,
  _dirty     integer not null default 0
);
`;

// SQLite erfordert fuer den erweiterten CHECK einen Tabellen-Neuaufbau mit Datenerhalt.
const V7_OUTBOX_RESTORE_OP = `
create table outbox_v7 (
  id              integer primary key autoincrement,
  entity          text    not null,
  entity_id       text    not null,
  op              text    not null check (op in ('insert','update','delete','restore')),
  payload         text    not null,
  created_at      integer not null,
  attempts        integer not null default 0,
  last_error      text,
  next_attempt_at integer not null default 0
);
insert into outbox_v7 (id, entity, entity_id, op, payload, created_at, attempts, last_error, next_attempt_at)
  select id, entity, entity_id, op, payload, created_at, attempts, last_error, next_attempt_at from outbox;
drop table outbox;
alter table outbox_v7 rename to outbox;
create index if not exists outbox_row_idx on outbox (entity, entity_id, id);
create index if not exists outbox_due_idx on outbox (next_attempt_at, id);
`;

// Reine Geraetestatistik ohne Outbox oder Server-Sync.
const V8_PRODUCT_USAGE = `
create table if not exists product_usage (
  id           text primary key not null,
  user_id      text not null,
  household_id text,
  feature      text not null check (feature in ('fridge','shopping_list','diary')),
  meal_type    text check (meal_type in ('breakfast','lunch','dinner','snack')),
  product_id   text,
  name         text not null,
  brand        text,
  barcode      text,
  unit         text,
  quantity     real,
  kcal         real,
  protein_g    real,
  carbs_g      real,
  fat_g        real,
  used_at      text not null
);
create index if not exists product_usage_lookup_idx
  on product_usage (user_id, feature, meal_type, used_at);
`;

// Rezeptkonsistenz wird serverseitig geprueft, da die lokale Pull-Reihenfolge offen ist.
const V9_RECIPES = `
create table if not exists recipes (
  id           text primary key not null,
  household_id text not null,
  title        text not null,
  instructions text,
  created_by   text,
  created_at   text,
  updated_at   integer not null,
  deleted_at   integer,
  _dirty       integer not null default 0
);
create index if not exists recipes_hh_idx on recipes (household_id, deleted_at);
create index if not exists recipes_dirty_idx on recipes (_dirty) where _dirty = 1;

create table if not exists recipe_components (
  id            text primary key not null,
  recipe_id     text not null,
  household_id  text not null,
  name          text not null,
  serving_grams real,
  created_at    text,
  updated_at    integer not null,
  deleted_at    integer,
  _dirty        integer not null default 0
);
create index if not exists recipe_components_recipe_idx on recipe_components (recipe_id, deleted_at);
create index if not exists recipe_components_dirty_idx on recipe_components (_dirty) where _dirty = 1;

create table if not exists recipe_component_items (
  id               text primary key not null,
  component_id     text not null,
  recipe_id        text not null,
  household_id     text not null,
  product_id       text,
  sub_component_id text,
  grams            real not null,
  created_at       text,
  updated_at       integer not null,
  deleted_at       integer,
  _dirty           integer not null default 0
);
create index if not exists recipe_component_items_component_idx on recipe_component_items (component_id, deleted_at);
create index if not exists recipe_component_items_dirty_idx on recipe_component_items (_dirty) where _dirty = 1;
`;

// Postgres-Arrays werden in SQLite als JSON-Text gespiegelt.
const V10_RECIPE_METADATA = `
alter table recipes add column steps text not null default '[]';
alter table recipes add column cover_image_path text;
alter table recipes add column cook_time_minutes integer;
alter table recipes add column difficulty text;
alter table recipes add column dish_types text not null default '[]';
alter table recipes add column dietary_tags text not null default '[]';
alter table recipes add column hashtags text not null default '[]';
alter table recipes add column default_servings integer not null default 1;
`;

// `grams` bleibt trotz editierbarer Menge und Einheit der kanonische Naehrwertwert.
const V11_RECIPE_STEPS = `
alter table recipes drop column steps;

alter table recipe_component_items add column quantity real;
alter table recipe_component_items add column unit text not null default 'g';

create table if not exists recipe_steps (
  id           text primary key not null,
  recipe_id    text not null,
  household_id text not null,
  position     integer not null,
  text         text not null,
  image_path   text,
  created_at   text,
  updated_at   integer not null,
  deleted_at   integer,
  _dirty       integer not null default 0
);
create index if not exists recipe_steps_recipe_idx on recipe_steps (recipe_id, deleted_at);
create index if not exists recipe_steps_dirty_idx on recipe_steps (_dirty) where _dirty = 1;

create table if not exists recipe_step_ingredients (
  id           text primary key not null,
  step_id      text not null,
  item_id      text not null,
  household_id text not null,
  created_at   text,
  updated_at   integer not null,
  deleted_at   integer,
  _dirty       integer not null default 0
);
create index if not exists recipe_step_ingredients_step_idx on recipe_step_ingredients (step_id, deleted_at);
create index if not exists recipe_step_ingredients_dirty_idx on recipe_step_ingredients (_dirty) where _dirty = 1;
`;

// Meal-Plan-Konsistenz und RLS bleiben serverseitig.
const V12_MEAL_PLANS = `
create table if not exists meal_plans (
  id              text primary key not null,
  household_id    text not null,
  name            text not null,
  week_start_date text not null,
  created_by      text,
  created_at      text,
  updated_at      integer not null,
  deleted_at      integer,
  _dirty          integer not null default 0
);
create index if not exists meal_plans_hh_idx on meal_plans (household_id, deleted_at);
create index if not exists meal_plans_week_idx on meal_plans (household_id, week_start_date);
create index if not exists meal_plans_dirty_idx on meal_plans (_dirty) where _dirty = 1;

create table if not exists meal_plan_entries (
  id            text primary key not null,
  meal_plan_id  text not null,
  household_id  text not null,
  recipe_id     text not null,
  entry_date    text not null,
  meal_slot     text not null,
  servings_mode text not null default 'portions',
  portions      real not null,
  people_count  integer,
  created_by    text,
  created_at    text,
  updated_at    integer not null,
  deleted_at    integer,
  _dirty        integer not null default 0
);
create index if not exists meal_plan_entries_plan_idx on meal_plan_entries (meal_plan_id, deleted_at);
create index if not exists meal_plan_entries_dirty_idx on meal_plan_entries (_dirty) where _dirty = 1;
`;

const V13_SHOPPING_LIST_RECIPE_NAMES = `
alter table shopping_list_items add column recipe_names text not null default '[]';
`;

// Packungsanzahl und Packungsinhalt bleiben getrennte Werte.
const V14_ITEM_PACKAGE_SIZE = `
alter table shopping_list_items add column package_size real;
alter table shopping_list_items add column package_size_unit text;
alter table fridge_items add column package_size real;
alter table fridge_items add column package_size_unit text;
`;

// Premium gilt haushaltsweit; SQLite spiegelt den Boolean als 0/1.
const V15_HOUSEHOLD_PREMIUM = `
alter table households add column premium_active integer not null default 0;
alter table households add column premium_expires_at text;
alter table households add column premium_updated_at text;
`;

const V16_RECIPE_STEP_TIMER = `
alter table recipe_steps add column timer_minutes integer;
`;

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'spiegeltabellen_outbox_sync_state',
    statements: [V1_MIRRORS, V1_OUTBOX, V1_STATE],
  },
  {
    version: 2,
    name: 'shopping_history',
    statements: [V2_SHOPPING_HISTORY],
  },
  {
    version: 3,
    name: 'stores',
    statements: [V3_STORES],
  },
  {
    version: 4,
    name: 'stores_reverse_order',
    statements: [V4_STORES_REVERSE_ORDER],
  },
  {
    version: 5,
    name: 'stores_category_order',
    statements: [V5_STORE_CATEGORY_ORDER],
  },
  {
    version: 6,
    name: 'households',
    statements: [V6_HOUSEHOLDS],
  },
  {
    version: 7,
    name: 'outbox_restore_op',
    statements: [V7_OUTBOX_RESTORE_OP],
  },
  {
    version: 8,
    name: 'product_usage',
    statements: [V8_PRODUCT_USAGE],
  },
  {
    version: 9,
    name: 'recipes',
    statements: [V9_RECIPES],
  },
  {
    version: 10,
    name: 'recipe_metadata_und_storage',
    statements: [V10_RECIPE_METADATA],
  },
  {
    version: 11,
    name: 'recipe_steps',
    statements: [V11_RECIPE_STEPS],
  },
  {
    version: 12,
    name: 'meal_plans',
    statements: [V12_MEAL_PLANS],
  },
  {
    version: 13,
    name: 'shopping_list_recipe_names',
    statements: [V13_SHOPPING_LIST_RECIPE_NAMES],
  },
  {
    version: 14,
    name: 'item_package_size',
    statements: [V14_ITEM_PACKAGE_SIZE],
  },
  {
    version: 15,
    name: 'household_premium',
    statements: [V15_HOUSEHOLD_PREMIUM],
  },
  {
    version: 16,
    name: 'recipe_step_timer',
    statements: [V16_RECIPE_STEP_TIMER],
  },
];
