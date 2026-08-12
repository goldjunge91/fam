-- Gewuenschter Endzustand — NICHT von Hand migrieren (#41, #123).
--
-- Rezept-Manager, "Baukasten-Mahlzeiten" (Epic #12, entschieden in
-- docs/plans/phase-2-4-brainstorm.md, Abschnitt #12).
--
-- Ein Rezept besteht aus Komponenten (z. B. "Nudeln", "Soße"). Eine
-- Komponente wiederum besteht aus Positionen: jede Position ist entweder
-- eine Basis-Zutat (`product_id` + Gramm) oder eine andere Komponente
-- desselben Rezepts (`sub_component_id` + Gramm) — daraus ergibt sich die
-- Rekursion ("Soße" besteht aus 50g Tomaten + 300g Hackfleisch).
--
-- Komponente und Position sind zwei Tabellen statt einer: Eine Komponente
-- braucht einen Namen und (fuer oberste Komponenten) eine Portionsmenge,
-- eine Position braucht eine Menge und genau ein Ziel. Beides in eine
-- Tabelle zu zwingen haette NULL-Spalten je nach Zeilentyp erfordert.
--
-- Nährwerte kommen ausschliesslich aus `products` — keine eigene
-- Naehrwert-Spalte hier, die berechnete Zusammensetzung ist Sache der reinen
-- Funktion in `src/features/recipes/nutrition.ts` (#124), nicht der DB.

-- -------------------------------------------------------------------- Rezepte
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,

  title text not null check (length(trim(title)) between 1 and 200),
  -- Kurzer Einfuehrungstext (Wizard-Schritt "Introduction"). Die eigentliche
  -- Zubereitung steht in `steps`, nicht hier.
  instructions text,
  -- Nummerierte Zubereitungsschritte, in Eingabereihenfolge. Bewusst ein
  -- Array statt einer eigenen Tabelle: kein Bedarf fuer Pro-Schritt-Metadaten
  -- (Timer/Audio sind eigene, spaeter geplante Paid-Features, #133-#136) —
  -- eine Spalte spart Tabelle, RLS und Sync-Entity fuer reine Textzeilen.
  steps text[] not null default '{}',

  cover_image_path text,
  cook_time_minutes integer check (cook_time_minutes > 0),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  -- Mehrfachauswahl im Wizard (z. B. "Snack" + "Brunch" gleichzeitig) — deshalb
  -- Array, nicht ein einzelner Wert wie bei `difficulty`.
  dish_types text[] not null default '{}'
    check (dish_types <@ array['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'appetizer', 'brunch']),
  dietary_tags text[] not null default '{}'
    check (dietary_tags <@ array['vegetarian', 'high_fat', 'low_fat', 'lactose_free', 'sugar_free', 'gluten_free']),
  -- Frei vergeben, kein fester Katalog wie bei dish_types/dietary_tags.
  hashtags text[] not null default '{}',
  -- Vom Autor angegebene Portionenzahl ("Serving for 4 People") — rein
  -- informativ, unabhaengig von den Gramm-Portionen der Komponenten
  -- (`recipe_components.serving_grams`).
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
-- Inkrementeller Pull der Sync-Engine (#47), analog zu fridge_items.
create index if not exists recipes_household_updated_idx
  on public.recipes (household_id, updated_at);

create or replace trigger recipes_set_updated_at
  before update on public.recipes
  for each row
  execute function private.set_updated_at();

-- ----------------------------------------------------------------- Komponenten
-- "1 Portion" (siehe Brainstorm-Dokument): oberste Komponenten (die nicht
-- selbst als sub_component_id einer anderen Position vorkommen) tragen ihre
-- Portions-Grammmenge direkt in `serving_grams`. Komponenten, die nur als
-- Unterkomponente einer anderen Komponente verwendet werden, lassen das Feld
-- leer — ihre Menge ergibt sich aus der Position, die auf sie zeigt.
create table if not exists public.recipe_components (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  -- Denormalisiert wie household_id auf Positionen anderer Tabellen: spart
  -- den Join ueber recipes in der RLS-Policy und im Sync-Index.
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

-- ------------------------------------------------------------------- Positionen
create table if not exists public.recipe_component_items (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.recipe_components (id) on delete cascade,
  -- Denormalisiert aus derselben Ueberlegung wie household_id oben.
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,

  -- Genau eines der beiden: entweder Basis-Zutat oder Unterkomponente
  -- desselben Rezepts (rekursiv, im Datenmodell unbegrenzt — das UI-Limit
  -- von 2 Ebenen ist Sache des Screens, nicht der DB, siehe #123-AC).
  product_id uuid references public.products (id) on delete set null,
  sub_component_id uuid references public.recipe_components (id) on delete cascade,

  grams numeric(8, 2) not null check (grams > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint recipe_component_items_exactly_one_target
    check (num_nonnulls (product_id, sub_component_id) = 1)
);

comment on table public.recipe_component_items is
  'Position innerhalb einer Komponente: entweder Zutat (product_id) oder Unterkomponente (sub_component_id), nie beides.';

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

-- ------------------------------------------------------- Konsistenz-Trigger
-- Ohne diese Pruefung koennte eine Position auf eine Komponente eines
-- fremden Rezepts zeigen, oder eine Komponente koennte sich selbst (direkt
-- oder ueber Umwege) als Unterkomponente enthalten — beides wuerde die
-- rekursive Naehrwert-Berechnung (#124) in eine Endlosschleife laufen lassen.
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

  -- Wuerde diese Position eine Zykel erzeugen? Pruefe, ob component_id unter
  -- den (transitiven) Unterkomponenten von sub_component_id vorkommt — dann
  -- enthielte component_id am Ende sich selbst.
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

-- ------------------------------------------------------------------------- RLS
alter table public.recipes enable row level security;
alter table public.recipe_components enable row level security;
alter table public.recipe_component_items enable row level security;

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
