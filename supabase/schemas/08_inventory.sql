-- Gewuenschter Endzustand — NICHT von Hand migrieren (#39, #40).
-- Bestand und Einkaufsliste sind geteilte, offline synchronisierte Haushaltsdaten.
-- deleted_at liefert Tombstones, damit Offline-Clients Loeschungen erkennen.

create table if not exists public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  kind text not null check (kind in ('fridge', 'freezer', 'pantry', 'custom')),
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  deleted_at timestamptz
);

create index if not exists storage_locations_household_id_idx
  on public.storage_locations (household_id);

create index if not exists storage_locations_household_updated_idx
  on public.storage_locations (household_id, updated_at);

create or replace trigger storage_locations_set_updated_at
  before update on public.storage_locations
  for each row
  execute function private.set_updated_at();

create table if not exists public.fridge_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  location_id uuid references public.storage_locations (id) on delete set null,

  -- Freie Eintraege brauchen keinen Produktbezug.
  product_id uuid references public.products (id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 200),

  quantity numeric(10, 3) not null default 1 check (quantity >= 0),
  unit text not null default 'piece'
    check (unit in ('g', 'kg', 'ml', 'l', 'piece', 'package', 'portion')),
  expiry_date date,

  added_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Packungsinhalt bleibt getrennt von der Einkaufsmenge und ist optional.
  package_size numeric(10, 3) check (package_size > 0),
  package_size_unit text
    check (package_size_unit in ('g', 'kg', 'ml', 'l', 'piece', 'portion')),
  constraint fridge_items_package_size_complete
    check ((package_size is null) = (package_size_unit is null))
);

comment on table public.fridge_items is
  'Geteilter Haushaltsbestand. Soft-Delete ueber deleted_at wegen Offline-Sync (#42).';

create index if not exists fridge_items_household_id_idx
  on public.fridge_items (household_id);
create index if not exists fridge_items_location_id_idx
  on public.fridge_items (location_id);
create index if not exists fridge_items_product_id_idx
  on public.fridge_items (product_id);
create index if not exists fridge_items_added_by_idx
  on public.fridge_items (added_by);

create index if not exists fridge_items_household_updated_idx
  on public.fridge_items (household_id, updated_at);

-- Der partielle Index schliesst geloeschte und undatierte Artikel aus.
create index if not exists fridge_items_expiry_idx
  on public.fridge_items (household_id, expiry_date)
  where deleted_at is null and expiry_date is not null;

create or replace trigger fridge_items_set_updated_at
  before update on public.fridge_items
  for each row
  execute function private.set_updated_at();

-- Maerkte sind frei verwaltbar; Ketten-Presets bleiben reine UI-Daten.
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  color text not null default '#6B7280' check (color ~* '^#[0-9a-f]{6}$'),
  sort_order integer not null default 0,
  -- Kategorie-Reihenfolgen gelten pro Markt; NULL oder leer nutzt den Standard.
  category_order text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Einkaufsmenge und Packungsinhalt bleiben getrennt.
  package_size numeric(10, 3) check (package_size > 0),
  package_size_unit text
    check (package_size_unit in ('g', 'kg', 'ml', 'l', 'piece', 'portion')),
  constraint shopping_list_items_package_size_complete
    check ((package_size is null) = (package_size_unit is null))
);

create index if not exists stores_household_id_idx
  on public.stores (household_id);
create index if not exists stores_household_updated_idx
  on public.stores (household_id, updated_at);
create unique index if not exists stores_household_name_lower_idx
  on public.stores (household_id, lower(trim(name)))
  where deleted_at is null;

create or replace trigger stores_set_updated_at
  before update on public.stores
  for each row
  execute function private.set_updated_at();

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 200),

  quantity numeric(10, 3) not null default 1 check (quantity >= 0),
  unit text not null default 'piece'
    check (unit in ('g', 'kg', 'ml', 'l', 'piece', 'package', 'portion')),
  -- Stabile IDs speichern die Klassifikation als Snapshot statt Live-Regel.
  category_id text check (
    category_id in (
      'produce', 'bakery', 'deli_meat', 'pantry_canned', 'pantry_dry', 'breakfast',
      'snacks', 'beverages', 'dairy', 'frozen', 'drugstore', 'checkout'
    )
  ),
  category_source text check (
    category_source in ('user', 'household_preference', 'off_taxonomy', 'name_fallback')
  ),
  category_classifier_version text check (
    category_classifier_version is null
    or length(trim(category_classifier_version)) between 1 and 100
  ),
  sort_index integer not null default 0,

  -- Geloeschte Maerkte duerfen Artikel nicht mitloeschen.
  store_id uuid references public.stores (id) on delete set null,
  price_estimate numeric(10, 2) check (price_estimate >= 0),

  -- Titel-Snapshots bilden mehrere Quellrezepte ab und ueberleben deren Umbenennung.
  recipe_names text[] not null default '{}',

  -- Der Zeitstempel ist historisierbar und per Last-Write-Wins mergebar.
  checked_at timestamptz,
  checked_by uuid references public.profiles (id) on delete set null,
  added_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Einkaufsmenge und Packungsinhalt bleiben getrennt.
  package_size numeric(10, 3) check (package_size > 0),
  package_size_unit text
    check (package_size_unit in ('g', 'kg', 'ml', 'l', 'piece', 'portion')),
  constraint shopping_list_items_package_size_complete
    check ((package_size is null) = (package_size_unit is null))
);

comment on table public.shopping_list_items is
  'Geteilte Einkaufsliste. checked_at als Zeitstempel, damit der Einkaufsabschluss rekonstruierbar bleibt.';

create index if not exists shopping_list_items_household_id_idx
  on public.shopping_list_items (household_id);
create index if not exists shopping_list_items_product_id_idx
  on public.shopping_list_items (product_id);
create index if not exists shopping_list_items_store_id_idx
  on public.shopping_list_items (store_id);
create index if not exists shopping_list_items_checked_by_idx
  on public.shopping_list_items (checked_by);
create index if not exists shopping_list_items_added_by_idx
  on public.shopping_list_items (added_by);
create index if not exists shopping_list_items_household_updated_idx
  on public.shopping_list_items (household_id, updated_at);

create or replace trigger shopping_list_items_set_updated_at
  before update on public.shopping_list_items
  for each row
  execute function private.set_updated_at();

-- Haushalt, Admin und Standardorte entstehen atomar.
create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  insert into public.households (name, created_by)
  values (household_name, uid)
  returning id into new_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_id, uid, 'admin');

  insert into public.storage_locations (household_id, name, kind, sort_order)
  values
    (new_id, 'Kühlschrank', 'fridge', 0),
    (new_id, 'Tiefkühltruhe', 'freezer', 1),
    (new_id, 'Abstellkammer', 'pantry', 2);

  insert into public.stores (household_id, name, color, sort_order)
  values
    (new_id, 'REWE', '#B5623F', 0),
    (new_id, 'Edeka', '#748C5B', 1),
    (new_id, 'Aldi', '#5C7396', 2);

  return new_id;
end;
$$;

create table if not exists public.shopping_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  completed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz not null,

  item_name text not null,
  quantity numeric(10, 3) not null,
  unit text not null,
  category_id text check (
    category_id in (
      'produce', 'bakery', 'deli_meat', 'pantry_canned', 'pantry_dry', 'breakfast',
      'snacks', 'beverages', 'dairy', 'frozen', 'drugstore', 'checkout'
    )
  ),
  category_source text check (
    category_source in ('user', 'household_preference', 'off_taxonomy', 'name_fallback')
  ),
  category_classifier_version text check (
    category_classifier_version is null
    or length(trim(category_classifier_version)) between 1 and 100
  ),
  product_id uuid references public.products (id) on delete set null,

  location_kind text check (location_kind in ('fridge', 'freezer', 'pantry')),
  expiry_date date,

  created_at timestamptz not null default now()
);

comment on table public.shopping_history is
  'Historie abgeschlossener Einkäufe. Append-only, kein Offline-Sync-Flag.';

create index if not exists shopping_history_household_id_idx
  on public.shopping_history (household_id);
create index if not exists shopping_history_completed_at_idx
  on public.shopping_history (household_id, completed_at);

alter table public.storage_locations enable row level security;
alter table public.stores enable row level security;
alter table public.fridge_items enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.shopping_history enable row level security;

-- Alle Mitglieder duerfen die geteilten Haushaltsdaten verwalten.
create policy storage_locations_all_member on public.storage_locations
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy stores_all_member on public.stores
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy fridge_items_all_member on public.fridge_items
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy shopping_list_items_all_member on public.shopping_list_items
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy shopping_history_all_member on public.shopping_history
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));
