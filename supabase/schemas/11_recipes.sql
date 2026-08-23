-- Gewuenschter Endzustand — NICHT von Hand migrieren (#41, #123).
-- Komponenten enthalten Zutaten oder rekursive Unterkomponenten desselben Rezepts.
-- Naehrwerte werden aus products berechnet und nicht redundant gespeichert.

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,

  title text not null check (length(trim(title)) between 1 and 200),
  instructions text,

  cover_image_path text,
  cook_time_minutes integer check (cook_time_minutes > 0),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  dish_types text[] not null default '{}'
    check (dish_types <@ array['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'appetizer', 'brunch']),
  dietary_tags text[] not null default '{}'
    check (dietary_tags <@ array['vegetarian', 'vegan', 'high_fat', 'low_fat', 'lactose_free', 'sugar_free', 'gluten_free']),
  hashtags text[] not null default '{}',
  -- Informative Portionenzahl, unabhaengig von serving_grams der Komponenten.
  default_servings integer not null default 1 check (default_servings > 0),

  created_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.recipes is
  'Rezeptsammlung, haushaltsweit geteilt. Nicht zwischen Haushalten geteilt.';

create index if not exists recipes_household_id_idx
  on public.recipes (household_id);
create index if not exists recipes_created_by_idx
  on public.recipes (created_by);
create index if not exists recipes_household_updated_idx
  on public.recipes (household_id, updated_at);

create or replace trigger recipes_set_updated_at
  before update on public.recipes
  for each row
  execute function private.set_updated_at();

-- Nur oberste Komponenten tragen serving_grams; Unterkomponenten beziehen ihre
-- Menge aus der referenzierenden Position.
create table if not exists public.recipe_components (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  -- Denormalisiert fuer RLS und Sync-Index.
  household_id uuid not null references public.households (id) on delete cascade,

  name text not null check (length(trim(name)) between 1 and 120),
  serving_grams numeric(8, 2) check (serving_grams > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.recipe_components is
  'Baukasten-Komponente eines Rezepts (z. B. "Soße"). serving_grams nur bei obersten Komponenten gesetzt.';

create index if not exists recipe_components_recipe_id_idx
  on public.recipe_components (recipe_id);
create index if not exists recipe_components_household_updated_idx
  on public.recipe_components (household_id, updated_at);

create or replace trigger recipe_components_set_updated_at
  before update on public.recipe_components
  for each row
  execute function private.set_updated_at();

create table if not exists public.recipe_component_items (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.recipe_components (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,

  -- Genau eines: Basis-Zutat oder Unterkomponente desselben Rezepts.
  product_id uuid references public.products (id) on delete set null,
  sub_component_id uuid references public.recipe_components (id) on delete cascade,

  -- Kanonische Rechengroesse fuer die clientseitige Naehrwertberechnung.
  grams numeric(8, 2) not null check (grams > 0),
  -- Rohe Nutzereingabe bleibt fuer Anzeige und Altdaten optional erhalten.
  quantity numeric(10, 2) check (quantity > 0),
  unit text not null default 'g'
    check (unit in ('g', 'kg', 'ml', 'l', 'piece', 'package', 'portion')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint recipe_component_items_exactly_one_target
    check (num_nonnulls (product_id, sub_component_id) = 1)
);

comment on table public.recipe_component_items is
  'Position innerhalb einer Komponente: entweder Zutat (product_id) oder Unterkomponente (sub_component_id), nie beides. quantity/unit ist die Roheingabe, grams die daraus abgeleitete kanonische Menge.';

create index if not exists recipe_component_items_component_id_idx
  on public.recipe_component_items (component_id);
create index if not exists recipe_component_items_product_id_idx
  on public.recipe_component_items (product_id);
create index if not exists recipe_component_items_sub_component_id_idx
  on public.recipe_component_items (sub_component_id);
create index if not exists recipe_component_items_household_updated_idx
  on public.recipe_component_items (household_id, updated_at);

create or replace trigger recipe_component_items_set_updated_at
  before update on public.recipe_component_items
  for each row
  execute function private.set_updated_at();

-- Eigene Zeilen erlauben Bilder und Zutatenreferenzen pro Schritt.
create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,

  position integer not null check (position >= 0),
  text text not null check (length(trim(text)) between 1 and 2000),
  image_path text,
  -- Explizite Timer haben Vorrang vor der Texterkennung im Kochmodus.
  timer_minutes integer check (timer_minutes > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.recipe_steps is
  'Ein Zubereitungsschritt eines Rezepts, in Reihenfolge ueber position. image_path zeigt in den recipe-step-images-Bucket (13_recipe_step_storage.sql). timer_minutes ist ein optionaler, explizit gesetzter Kochmodus-Timer.';

create index if not exists recipe_steps_recipe_id_idx
  on public.recipe_steps (recipe_id);
create index if not exists recipe_steps_household_updated_idx
  on public.recipe_steps (household_id, updated_at);

create or replace trigger recipe_steps_set_updated_at
  before update on public.recipe_steps
  for each row
  execute function private.set_updated_at();

create table if not exists public.recipe_step_ingredients (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.recipe_steps (id) on delete cascade,
  item_id uuid not null references public.recipe_component_items (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (step_id, item_id)
);

comment on table public.recipe_step_ingredients is
  'Verknuepft einen Zubereitungsschritt mit den darin verwendeten Zutaten-Positionen (recipe_component_items), fuer die Zutaten-Chips im Wizard und in der Detailansicht.';

create index if not exists recipe_step_ingredients_step_id_idx
  on public.recipe_step_ingredients (step_id);
create index if not exists recipe_step_ingredients_item_id_idx
  on public.recipe_step_ingredients (item_id);
create index if not exists recipe_step_ingredients_household_updated_idx
  on public.recipe_step_ingredients (household_id, updated_at);

create or replace trigger recipe_step_ingredients_set_updated_at
  before update on public.recipe_step_ingredients
  for each row
  execute function private.set_updated_at();

-- Verhindert Fremdrezept-Referenzen und Zyklen in der Komponentenstruktur.
create or replace function private.check_recipe_component_item_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub_recipe_id uuid;
  creates_cycle boolean;
begin
  if new.sub_component_id is null then
    return new;
  end if;

  if new.sub_component_id = new.component_id then
    raise exception 'Eine Komponente kann sich nicht selbst als Unterkomponente enthalten';
  end if;

  select recipe_id into sub_recipe_id
  from public.recipe_components
  where id = new.sub_component_id;

  if sub_recipe_id is distinct from new.recipe_id then
    raise exception 'Unterkomponente gehoert zu einem anderen Rezept';
  end if;

  -- Eine transitive Rueckreferenz wuerde einen Zyklus erzeugen.
  with recursive descendants as (
    select new.sub_component_id as comp_id
    union all
    select rci.sub_component_id
    from public.recipe_component_items rci
    join descendants d on rci.component_id = d.comp_id
    where rci.sub_component_id is not null
  )
  select exists (select 1 from descendants where comp_id = new.component_id)
  into creates_cycle;

  if creates_cycle then
    raise exception 'Diese Zuordnung wuerde eine zyklische Komponenten-Verschachtelung erzeugen';
  end if;

  return new;
end;
$$;

create or replace trigger recipe_component_items_check_consistency
  before insert or update on public.recipe_component_items
  for each row
  execute function private.check_recipe_component_item_consistency();

alter table public.recipes enable row level security;
alter table public.recipe_components enable row level security;
alter table public.recipe_component_items enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.recipe_step_ingredients enable row level security;

create policy recipes_household on public.recipes
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy recipe_components_household on public.recipe_components
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy recipe_component_items_household on public.recipe_component_items
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy recipe_steps_household on public.recipe_steps
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy recipe_step_ingredients_household on public.recipe_step_ingredients
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));
