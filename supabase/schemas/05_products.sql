-- Gewuenschter Endzustand — NICHT von Hand migrieren (#38).
-- Lokale Produktkopien entkoppeln Offline-Zugriff und Historie von Open Food Facts.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),

  barcode text unique,
  name text not null check (length(trim(name)) between 1 and 200),
  brand text,

  -- Schranken filtern unplausible Crowdsourcing-Werte vor der Kalorienbilanz.
  kcal_per_100 numeric(7, 2) check (kcal_per_100 >= 0 and kcal_per_100 <= 900),
  protein_g_per_100 numeric(6, 2) check (protein_g_per_100 between 0 and 100),
  carbs_g_per_100 numeric(6, 2) check (carbs_g_per_100 between 0 and 100),
  fat_g_per_100 numeric(6, 2) check (fat_g_per_100 between 0 and 100),
  fiber_g_per_100 numeric(6, 2) check (fiber_g_per_100 between 0 and 100),
  sugar_g_per_100 numeric(6, 2) check (sugar_g_per_100 between 0 and 100),
  salt_g_per_100 numeric(6, 2) check (salt_g_per_100 between 0 and 100),

  -- Nullable, weil nicht jedes Produkt eine bekannte Stueck-Umrechnung hat.
  serving_size_g numeric(7, 2) check (serving_size_g > 0),

  -- Unveraenderte OFF-Tag-IDs halten Live-, Barcode- und Dump-Klassifikation konsistent.
  off_category_tags text[] not null default '{}',
  off_last_modified_at timestamptz,

  source text not null default 'manual' check (source in ('off', 'manual')),

  -- Produkte ueberleben die Loeschung ihres Erstellers.
  created_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is
  'Lebensmittel-Stammdaten, global lesbar. Nur selbst angelegte Produkte sind aenderbar.';

-- Deutsches Stemming findet auch gebeugte Produktnamen.
create index if not exists products_name_fts_idx
  on public.products using gin (to_tsvector('german', name));

create index if not exists products_created_by_idx on public.products (created_by);

-- Die id stabilisiert den globalen Keyset-Cursor bei gleichen Zeitstempeln.
create index if not exists products_updated_idx on public.products (updated_at, id);

create or replace trigger products_set_updated_at
  before update on public.products
  for each row
  execute function private.set_updated_at();

alter table public.products enable row level security;

create policy products_select_all on public.products
  for select to authenticated
  using (true);

create policy products_insert_own on public.products
  for insert to authenticated
  with check (
    (select auth.uid()) = created_by
    and off_category_tags = '{}'::text[]
    and off_last_modified_at is null
  );

-- Geteilte OFF-Produkte duerfen nicht von einzelnen Nutzern veraendert werden.
create policy products_update_own_manual on public.products
  for update to authenticated
  using ((select auth.uid()) = created_by and source = 'manual')
  with check ((select auth.uid()) = created_by and source = 'manual');
