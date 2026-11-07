-- Globale Zutatenidentitaeten und gepruefte EU-Allergenkenntnis fuer Rezeptvorschlaege.

create table if not exists public.allergen_taxonomy (
  id text primary key check (id in (
    'EU_01_GLUTEN_CEREALS',
    'EU_02_CRUSTACEANS',
    'EU_03_EGGS',
    'EU_04_FISH',
    'EU_05_PEANUTS',
    'EU_06_SOYBEANS',
    'EU_07_MILK',
    'EU_08_NUTS',
    'EU_09_CELERY',
    'EU_10_MUSTARD',
    'EU_11_SESAME',
    'EU_12_SULPHITES',
    'EU_13_LUPIN',
    'EU_14_MOLLUSCS'
  )),
  sort_order smallint not null unique check (sort_order between 1 and 14),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.allergen_taxonomy is
  'Referenzcodes fuer die vierzehn Allergengruppen aus EU 1169/2011 Annex II.';

create table if not exists public.food_ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (length(trim(canonical_name)) between 1 and 200),
  allergen_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists food_ingredients_canonical_name_idx
  on public.food_ingredients (lower(trim(canonical_name)));

comment on column public.food_ingredients.allergen_reviewed_at is
  'Null means allergen knowledge is incomplete; a timestamp marks a complete review, including a reviewed clear result.';

create table if not exists public.ingredient_allergen_mappings (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.food_ingredients (id) on delete cascade,
  allergen_id text not null references public.allergen_taxonomy (id),
  relation text not null check (relation in ('contains', 'derived_from', 'may_contain')),
  source text not null check (source in ('curated', 'eu_lmiv', 'open_food_facts', 'foodon')),
  source_id text not null check (length(trim(source_id)) between 1 and 240),
  source_url text not null check (length(trim(source_url)) between 1 and 500),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  license text not null check (length(trim(license)) between 1 and 160),
  confidence text not null check (confidence in ('verified', 'external', 'inferred')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredient_allergen_verified_review_required check (
    confidence <> 'verified' or reviewed_at is not null
  ),
  unique (ingredient_id, allergen_id, relation, source, source_id)
);

create index if not exists ingredient_allergen_mappings_allergen_idx
  on public.ingredient_allergen_mappings (allergen_id, ingredient_id);

create table if not exists public.product_ingredient_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  ingredient_id uuid not null references public.food_ingredients (id) on delete cascade,
  source text not null check (source in ('curated', 'open_food_facts', 'foodon')),
  source_id text not null check (length(trim(source_id)) between 1 and 240),
  source_url text not null check (length(trim(source_url)) between 1 and 500),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  license text not null check (length(trim(license)) between 1 and 160),
  confidence text not null check (confidence in ('verified', 'external', 'inferred')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_ingredient_link_verified_review_required check (
    confidence <> 'verified' or reviewed_at is not null
  ),
  unique (product_id, ingredient_id, source, source_id)
);

create index if not exists product_ingredient_links_ingredient_idx
  on public.product_ingredient_links (ingredient_id, product_id);

create table if not exists public.catalog_recipe_item_ingredient_links (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references public.catalog_recipe_component_items (id) on delete cascade,
  ingredient_id uuid not null references public.food_ingredients (id) on delete cascade,
  source text not null check (source in ('curated', 'open_food_facts', 'foodon')),
  source_id text not null check (length(trim(source_id)) between 1 and 240),
  source_url text not null check (length(trim(source_url)) between 1 and 500),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  license text not null check (length(trim(license)) between 1 and 160),
  confidence text not null check (confidence in ('verified', 'external', 'inferred')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_recipe_item_ingredient_link_verified_review_required check (
    confidence <> 'verified' or reviewed_at is not null
  ),
  unique (catalog_item_id, ingredient_id, source, source_id)
);

create index if not exists catalog_recipe_item_ingredient_links_ingredient_idx
  on public.catalog_recipe_item_ingredient_links (ingredient_id, catalog_item_id);

create or replace trigger allergen_taxonomy_set_updated_at
  before update on public.allergen_taxonomy
  for each row execute function private.set_updated_at();
create or replace trigger food_ingredients_set_updated_at
  before update on public.food_ingredients
  for each row execute function private.set_updated_at();
create or replace trigger ingredient_allergen_mappings_set_updated_at
  before update on public.ingredient_allergen_mappings
  for each row execute function private.set_updated_at();
create or replace trigger product_ingredient_links_set_updated_at
  before update on public.product_ingredient_links
  for each row execute function private.set_updated_at();
create or replace trigger catalog_recipe_item_ingredient_links_set_updated_at
  before update on public.catalog_recipe_item_ingredient_links
  for each row execute function private.set_updated_at();

alter table public.allergen_taxonomy enable row level security;
alter table public.food_ingredients enable row level security;
alter table public.ingredient_allergen_mappings enable row level security;
alter table public.product_ingredient_links enable row level security;
alter table public.catalog_recipe_item_ingredient_links enable row level security;

create policy allergen_taxonomy_select_authenticated on public.allergen_taxonomy
  for select to authenticated using (true);
create policy food_ingredients_select_authenticated on public.food_ingredients
  for select to authenticated using (true);
create policy ingredient_allergen_mappings_select_authenticated on public.ingredient_allergen_mappings
  for select to authenticated using (true);
create policy product_ingredient_links_select_authenticated on public.product_ingredient_links
  for select to authenticated using (true);
create policy catalog_recipe_item_ingredient_links_select_published
  on public.catalog_recipe_item_ingredient_links
  for select to authenticated using (exists (
    select 1
    from public.catalog_recipe_component_items item
    join public.catalog_recipes recipe on recipe.id = item.recipe_id
    where item.id = catalog_item_id and recipe.status = 'published'
  ));
