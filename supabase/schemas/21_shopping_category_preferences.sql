-- Gewuenschter Endzustand — NICHT von Hand migrieren (#223 Paket 2 / #225).
-- Haushaltsweite Offline-Korrekturen nutzen eine deterministische UUIDv5 ohne Default.

create table if not exists public.shopping_category_preferences (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,

  key_type text not null check (key_type in ('product', 'name')),
  normalized_key_value text not null,

  -- NULL bedeutet eine explizit gelernte Sonstiges-Entscheidung.
  category_id text check (
    category_id in (
      'produce', 'bakery', 'deli_meat', 'pantry_canned', 'pantry_dry', 'breakfast',
      'snacks', 'beverages', 'dairy', 'frozen', 'drugstore', 'checkout'
    )
  ),

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Auch Tombstones reservieren die natuerliche Identitaet fuer dieselbe UUID.
  constraint shopping_category_preferences_natural_key_key
    unique (household_id, key_type, normalized_key_value)
);

alter table public.shopping_category_preferences
  add constraint shopping_category_preferences_normalized_key_check
  check (normalized_key_value <> '');

comment on table public.shopping_category_preferences is
  'Haushaltsweite Kategorie-Korrekturen mit deterministischer UUIDv5 und Soft Delete.';

-- Der Unique-Index deckt den household_id-Lookup bereits ab.
create index if not exists shopping_category_preferences_created_by_idx
  on public.shopping_category_preferences (created_by);

create index if not exists shopping_category_preferences_household_updated_idx
  on public.shopping_category_preferences (household_id, updated_at, id);

create or replace trigger shopping_category_preferences_set_updated_at
  before update on public.shopping_category_preferences
  for each row
  execute function private.set_updated_at();

alter table public.shopping_category_preferences enable row level security;

create policy shopping_category_preferences_all_member
  on public.shopping_category_preferences
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));
