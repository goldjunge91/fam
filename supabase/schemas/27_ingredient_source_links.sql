-- Provenienzbehaftete Links zwischen fam-Produkten/Katalogzutaten und der
-- getrennten Ingredient-Wissensbasis. Provider werden importseitig auf lokale
-- Identitaeten aufgeloest; das Gateway ruft die Provider nicht direkt auf.

create table if not exists public.product_ingredient_links (
  product_id uuid not null references public.products (id) on delete cascade,
  ingredient_id uuid not null references public.external_food_ingredients (id) on delete cascade,
  source text not null check (source in ('open_food_facts', 'foodon', 'curated')),
  source_id text not null check (length(trim(source_id)) between 1 and 240),
  source_url text not null check (length(trim(source_url)) between 1 and 500),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  license text not null check (length(trim(license)) between 1 and 160),
  confidence text not null check (confidence in ('verified', 'external', 'inferred')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, ingredient_id, source),
  constraint product_ingredient_link_review_required check (
    confidence <> 'verified' or reviewed_at is not null
  )
);

comment on table public.product_ingredient_links is
  'Provider-/Kurationslink eines globalen Produkts auf eine lokale Ingredient-Identitaet.';

create index if not exists product_ingredient_links_ingredient_idx
  on public.product_ingredient_links (ingredient_id, product_id);

create table if not exists public.catalog_recipe_item_ingredient_links (
  catalog_item_id uuid not null references public.catalog_recipe_component_items (id) on delete cascade,
  ingredient_id uuid not null references public.external_food_ingredients (id) on delete cascade,
  source text not null check (source in ('open_food_facts', 'foodon', 'curated')),
  source_id text not null check (length(trim(source_id)) between 1 and 240),
  source_url text not null check (length(trim(source_url)) between 1 and 500),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  license text not null check (length(trim(license)) between 1 and 160),
  confidence text not null check (confidence in ('verified', 'external', 'inferred')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (catalog_item_id, ingredient_id, source),
  constraint catalog_recipe_item_ingredient_link_review_required check (
    confidence <> 'verified' or reviewed_at is not null
  )
);

comment on table public.catalog_recipe_item_ingredient_links is
  'Provider-/Kurationslink eines publizierten Katalogitems auf eine lokale Ingredient-Identitaet.';

create index if not exists catalog_recipe_item_ingredient_links_ingredient_idx
  on public.catalog_recipe_item_ingredient_links (ingredient_id, catalog_item_id);

create or replace trigger product_ingredient_links_set_updated_at
  before update on public.product_ingredient_links
  for each row
  execute function private.set_updated_at();

create or replace trigger catalog_recipe_item_ingredient_links_set_updated_at
  before update on public.catalog_recipe_item_ingredient_links
  for each row
  execute function private.set_updated_at();

alter table public.product_ingredient_links enable row level security;
alter table public.catalog_recipe_item_ingredient_links enable row level security;

create policy product_ingredient_links_select_authenticated
  on public.product_ingredient_links
  for select to authenticated using (true);

create policy catalog_recipe_item_ingredient_links_select_published
  on public.catalog_recipe_item_ingredient_links
  for select to authenticated using (exists (
    select 1
    from public.catalog_recipe_component_items item
    join public.catalog_recipes recipe on recipe.id = item.recipe_id
    where item.id = catalog_item_id
      and recipe.status = 'published'
  ));

revoke all on public.product_ingredient_links,
  public.catalog_recipe_item_ingredient_links from anon, authenticated, service_role;
grant select on public.product_ingredient_links,
  public.catalog_recipe_item_ingredient_links to authenticated;
grant delete, insert, select, update on public.product_ingredient_links,
  public.catalog_recipe_item_ingredient_links to service_role;
