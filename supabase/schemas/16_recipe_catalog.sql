-- Globaler, redaktionell gepflegter Rezeptkatalog.
-- Katalogrezepte sind read-only fuer Clients und werden erst durch eine
-- explizite Nutzeraktion in die haushaltsgebundene `recipes`-Struktur kopiert.

create table if not exists public.catalog_recipes (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  slug text not null unique check (length(trim(slug)) between 1 and 160),
  title text not null check (length(trim(title)) between 1 and 200),
  instructions text,
  cook_time_minutes integer check (cook_time_minutes > 0),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  dish_types text[] not null default '{}'
    check (dish_types <@ array['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'appetizer', 'brunch']),
  dietary_tags text[] not null default '{}'
    check (dietary_tags <@ array['vegetarian', 'vegan', 'high_fat', 'low_fat', 'lactose_free', 'sugar_free', 'gluten_free']),
  hashtags text[] not null default '{}',
  default_servings integer not null default 1 check (default_servings > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists catalog_recipes_status_sort_idx
  on public.catalog_recipes (status, sort_order, title);

create table if not exists public.catalog_recipe_components (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.catalog_recipes (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  serving_grams numeric(8, 2) check (serving_grams > 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_recipe_components_recipe_idx
  on public.catalog_recipe_components (recipe_id, position);

create table if not exists public.catalog_recipe_component_items (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.catalog_recipe_components (id) on delete cascade,
  recipe_id uuid not null references public.catalog_recipes (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  sub_component_id uuid references public.catalog_recipe_components (id) on delete cascade,
  ingredient_name text,
  grams numeric(8, 2) not null check (grams > 0),
  quantity numeric(10, 2) check (quantity > 0),
  unit text not null default 'g'
    check (unit in ('g', 'kg', 'ml', 'l', 'piece', 'package', 'portion')),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_recipe_items_target_check check (
    num_nonnulls(product_id, sub_component_id, ingredient_name) = 1
  )
);

create index if not exists catalog_recipe_items_component_idx
  on public.catalog_recipe_component_items (component_id, position);
create index if not exists catalog_recipe_items_recipe_idx
  on public.catalog_recipe_component_items (recipe_id);

create table if not exists public.catalog_recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.catalog_recipes (id) on delete cascade,
  position integer not null check (position >= 0),
  text text not null check (length(trim(text)) between 1 and 2000),
  timer_minutes integer check (timer_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, position)
);

create table if not exists public.catalog_recipe_step_ingredients (
  step_id uuid not null references public.catalog_recipe_steps (id) on delete cascade,
  item_id uuid not null references public.catalog_recipe_component_items (id) on delete cascade,
  recipe_id uuid not null references public.catalog_recipes (id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  primary key (step_id, item_id)
);

create index if not exists catalog_recipe_step_ingredients_recipe_idx
  on public.catalog_recipe_step_ingredients (recipe_id, step_id, position);

create table if not exists public.catalog_recipe_images (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.catalog_recipes (id) on delete cascade,
  storage_path text not null unique,
  alt_text text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

create index if not exists catalog_recipe_images_recipe_idx
  on public.catalog_recipe_images (recipe_id, position);

create table if not exists public.catalog_recipe_step_images (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.catalog_recipe_steps (id) on delete cascade,
  recipe_id uuid not null references public.catalog_recipes (id) on delete cascade,
  storage_path text not null unique,
  alt_text text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

create index if not exists catalog_recipe_step_images_step_idx
  on public.catalog_recipe_step_images (step_id, position);

create or replace function private.catalog_recipe_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger catalog_recipes_set_updated_at before update on public.catalog_recipes
  for each row execute function private.catalog_recipe_updated_at();
create trigger catalog_recipe_components_set_updated_at before update on public.catalog_recipe_components
  for each row execute function private.catalog_recipe_updated_at();
create trigger catalog_recipe_items_set_updated_at before update on public.catalog_recipe_component_items
  for each row execute function private.catalog_recipe_updated_at();
create trigger catalog_recipe_steps_set_updated_at before update on public.catalog_recipe_steps
  for each row execute function private.catalog_recipe_updated_at();

alter table public.catalog_recipes enable row level security;
alter table public.catalog_recipe_components enable row level security;
alter table public.catalog_recipe_component_items enable row level security;
alter table public.catalog_recipe_steps enable row level security;
alter table public.catalog_recipe_step_ingredients enable row level security;
alter table public.catalog_recipe_images enable row level security;
alter table public.catalog_recipe_step_images enable row level security;

create policy catalog_recipes_select_published on public.catalog_recipes
  for select to authenticated using (status = 'published');
create policy catalog_components_select_published on public.catalog_recipe_components
  for select to authenticated using (exists (
    select 1 from public.catalog_recipes r where r.id = recipe_id and r.status = 'published'
  ));
create policy catalog_items_select_published on public.catalog_recipe_component_items
  for select to authenticated using (exists (
    select 1 from public.catalog_recipes r where r.id = recipe_id and r.status = 'published'
  ));
create policy catalog_steps_select_published on public.catalog_recipe_steps
  for select to authenticated using (exists (
    select 1 from public.catalog_recipes r where r.id = recipe_id and r.status = 'published'
  ));
create policy catalog_step_ingredients_select_published on public.catalog_recipe_step_ingredients
  for select to authenticated using (exists (
    select 1 from public.catalog_recipes r where r.id = recipe_id and r.status = 'published'
  ));
create policy catalog_images_select_published on public.catalog_recipe_images
  for select to authenticated using (exists (
    select 1 from public.catalog_recipes r where r.id = recipe_id and r.status = 'published'
  ));
create policy catalog_step_images_select_published on public.catalog_recipe_step_images
  for select to authenticated using (exists (
    select 1 from public.catalog_recipe_steps s
    join public.catalog_recipes r on r.id = s.recipe_id
    where s.id = step_id and r.status = 'published'
  ));

grant select on public.catalog_recipes, public.catalog_recipe_components,
  public.catalog_recipe_component_items, public.catalog_recipe_steps,
  public.catalog_recipe_step_ingredients, public.catalog_recipe_images,
  public.catalog_recipe_step_images to authenticated;
