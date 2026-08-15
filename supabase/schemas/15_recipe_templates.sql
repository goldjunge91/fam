-- Gewuenschter Endzustand — NICHT von Hand migrieren (#41, #123).
--
-- Vorgefertigte Rezepte ("Vorlagen"): admin-kuratierte, global lesbare
-- Rezeptbibliothek, aus der ein Haushalt per Client-seitigem Kopiervorgang
-- (siehe src/features/recipe-templates/use-recipe-templates.ts) ein eigenes
-- Rezept in recipes/recipe_components/recipe_component_items/recipe_steps
-- anlegen kann.
--
-- Bewusst eine eigene Tabellenfamilie statt recipes mit household_id = null:
-- Vorlagen sind nie editierbarer Nutzer-Content (kein created_by, kein
-- Soft-Delete/Tombstone, RLS erlaubt nur SELECT), recipes dagegen ist
-- durchgehend Nutzer-Content mit Autor und Loeschbarkeit. Eine gemeinsame
-- Tabelle haette beide Faelle vermischt und die RLS-Policies verkompliziert.
--
-- Anders als recipes/products wird diese Tabellenfamilie NICHT in die lokale
-- SQLite-Spiegelung aufgenommen (kein Eintrag in src/lib/db/entities.ts) —
-- der Vorlagen-Screen fragt live gegen Supabase ab (getSupabase()), da
-- Vorlagen kein Kern-Offline-Datensatz sind.

-- ------------------------------------------------------------------ Vorlagen
create table if not exists public.recipe_templates (
  id uuid primary key default gen_random_uuid(),

  title text not null check (length(trim(title)) between 1 and 200),
  instructions text,

  -- Slug eines gebuendelten App-Assets aus assets/rezepte/<slug>.jpg, kein
  -- Supabase-Storage-Pfad (siehe src/features/recipe-templates/template-cover-images.ts).
  -- Vorlagen sind global und admin-kuratiert, daher passt ein gebuendeltes
  -- Asset besser als der private, haushaltsscoped recipe-covers-Bucket, der
  -- fuer recipes.cover_image_path verwendet wird.
  cover_image_path text,
  cook_time_minutes integer check (cook_time_minutes > 0),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  dish_types text[] not null default '{}'
    check (dish_types <@ array['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'appetizer', 'brunch']),
  dietary_tags text[] not null default '{}'
    check (dietary_tags <@ array['vegetarian', 'vegan', 'high_fat', 'low_fat', 'lactose_free', 'sugar_free', 'gluten_free']),
  hashtags text[] not null default '{}',
  default_servings integer not null default 1 check (default_servings > 0),

  -- Kuratierungs-Reihenfolge fuer den Vorlagen-Screen (nicht alphabetisch).
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recipe_templates is
  'Admin-kuratierte Rezeptvorlagen, global lesbar, read-only fuer Clients. Wird per Client-Kopiervorgang in recipes uebernommen.';

create index if not exists recipe_templates_sort_order_idx
  on public.recipe_templates (sort_order);
-- Inkrementeller Pull ist hier nicht noetig (keine lokale Spiegelung), der
-- Index folgt trotzdem dem Muster aus 05_products.sql fuer den Fall, dass
-- eine spaetere Version doch spiegelt.
create index if not exists recipe_templates_updated_idx
  on public.recipe_templates (updated_at, id);

create or replace trigger recipe_templates_set_updated_at
  before update on public.recipe_templates
  for each row
  execute function private.set_updated_at();

-- --------------------------------------------------------------- Komponenten
create table if not exists public.recipe_template_components (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.recipe_templates (id) on delete cascade,

  name text not null check (length(trim(name)) between 1 and 120),
  serving_grams numeric(8, 2) check (serving_grams > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recipe_template_components is
  'Baukasten-Komponente einer Rezeptvorlage, analog zu recipe_components.';

create index if not exists recipe_template_components_template_id_idx
  on public.recipe_template_components (template_id);

create or replace trigger recipe_template_components_set_updated_at
  before update on public.recipe_template_components
  for each row
  execute function private.set_updated_at();

-- ----------------------------------------------------------------- Positionen
create table if not exists public.recipe_template_items (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.recipe_template_components (id) on delete cascade,
  template_id uuid not null references public.recipe_templates (id) on delete cascade,

  -- Genau eines der beiden, analog zu recipe_component_items.
  product_id uuid references public.products (id) on delete set null,
  sub_component_id uuid references public.recipe_template_components (id) on delete cascade,

  grams numeric(8, 2) not null check (grams > 0),
  quantity numeric(10, 2) check (quantity > 0),
  unit text not null default 'g'
    check (unit in ('g', 'kg', 'ml', 'l', 'piece', 'package', 'portion')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recipe_template_items_exactly_one_target
    check (num_nonnulls (product_id, sub_component_id) = 1)
);

comment on table public.recipe_template_items is
  'Position innerhalb einer Vorlagen-Komponente: Zutat (product_id) oder Unterkomponente (sub_component_id), nie beides.';

create index if not exists recipe_template_items_component_id_idx
  on public.recipe_template_items (component_id);
create index if not exists recipe_template_items_product_id_idx
  on public.recipe_template_items (product_id);
create index if not exists recipe_template_items_sub_component_id_idx
  on public.recipe_template_items (sub_component_id);

create or replace trigger recipe_template_items_set_updated_at
  before update on public.recipe_template_items
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------- Zubereitungsschritte
create table if not exists public.recipe_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.recipe_templates (id) on delete cascade,

  position integer not null check (position >= 0),
  text text not null check (length(trim(text)) between 1 and 2000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recipe_template_steps is
  'Ein Zubereitungsschritt einer Rezeptvorlage, in Reihenfolge ueber position. Anders als recipe_steps kein image_path/keine Zutaten-Verknuepfung (Scope-Cut).';

create index if not exists recipe_template_steps_template_id_idx
  on public.recipe_template_steps (template_id);

create or replace trigger recipe_template_steps_set_updated_at
  before update on public.recipe_template_steps
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------- Konsistenz-Trigger
-- Analog zu private.check_recipe_component_item_consistency() (11_recipes.sql):
-- verhindert, dass eine Position auf eine Komponente einer fremden Vorlage
-- zeigt oder eine Komponente sich selbst (direkt/ueber Umwege) enthaelt.
create or replace function private.check_recipe_template_item_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub_template_id uuid;
  creates_cycle boolean;
begin
  if new.sub_component_id is null then
    return new;
  end if;

  if new.sub_component_id = new.component_id then
    raise exception 'Eine Komponente kann sich nicht selbst als Unterkomponente enthalten';
  end if;

  select template_id into sub_template_id
  from public.recipe_template_components
  where id = new.sub_component_id;

  if sub_template_id is distinct from new.template_id then
    raise exception 'Unterkomponente gehoert zu einer anderen Vorlage';
  end if;

  with recursive descendants as (
    select new.sub_component_id as comp_id
    union all
    select rti.sub_component_id
    from public.recipe_template_items rti
    join descendants d on rti.component_id = d.comp_id
    where rti.sub_component_id is not null
  )
  select exists (select 1 from descendants where comp_id = new.component_id)
  into creates_cycle;

  if creates_cycle then
    raise exception 'Diese Zuordnung wuerde eine zyklische Komponenten-Verschachtelung erzeugen';
  end if;

  return new;
end;
$$;

create or replace trigger recipe_template_items_check_consistency
  before insert or update on public.recipe_template_items
  for each row
  execute function private.check_recipe_template_item_consistency();

-- ------------------------------------------------------------------------- RLS
alter table public.recipe_templates enable row level security;
alter table public.recipe_template_components enable row level security;
alter table public.recipe_template_items enable row level security;
alter table public.recipe_template_steps enable row level security;

-- Read-only fuer Clients (Muster aus 05_products.sql: products_select_all) —
-- bewusst keine insert/update/delete-Policy: Vorlagen werden ausschliesslich
-- ueber supabase/seed.sql bzw. kuenftig ein Admin-Tool per service_role
-- gepflegt, nie von einem Haushalt.
create policy recipe_templates_select_all on public.recipe_templates
  for select to authenticated
  using (true);

create policy recipe_template_components_select_all on public.recipe_template_components
  for select to authenticated
  using (true);

create policy recipe_template_items_select_all on public.recipe_template_items
  for select to authenticated
  using (true);

create policy recipe_template_steps_select_all on public.recipe_template_steps
  for select to authenticated
  using (true);
