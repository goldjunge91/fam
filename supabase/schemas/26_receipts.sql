-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- Kanonische Receipt-Daten. Receipts und Positionen sind synchronisierte
-- Haushaltsdaten; receipt_assets bleibt ein serverseitiger Storage-Index.

create table if not exists public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  purchase_date date,

  currency text not null default 'EUR'
    check (currency = 'EUR'),
  total_cents bigint check (total_cents >= 0),
  processing_status text not null default 'draft'
    check (processing_status in ('draft', 'processing', 'needs_review', 'confirmed', 'failed')),

  created_by uuid not null references public.profiles (id) on delete restrict,
  confirmed_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint receipts_id_household_key unique (id, household_id),
  constraint receipts_confirmation_pair
    check ((confirmed_by is null) = (confirmed_at is null))
);

comment on table public.purchase_receipts is
  'Geteilter Kassenbon eines Haushalts. EUR-Cents, Review-Status und Tombstone bleiben autoritativ auf dem Server.';

create index if not exists receipts_household_id_idx
  on public.purchase_receipts (household_id);
create index if not exists receipts_household_updated_idx
  on public.purchase_receipts (household_id, updated_at);
create index if not exists receipts_store_id_idx
  on public.purchase_receipts (store_id);

create or replace trigger receipts_set_updated_at
  before update on public.purchase_receipts
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------------- Receipt-Items
create table if not exists public.purchase_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  household_id uuid not null references public.households (id) on delete cascade,
  position integer not null check (position >= 0),
  name text not null check (length(trim(name)) between 1 and 200),

  product_id uuid references public.products (id) on delete set null,
  category_id text check (
    category_id is null
    or category_id in (
      'fresh_produce', 'bakery', 'chilled_dairy_eggs', 'ambient_milk_drinks',
      'chilled_plant_based', 'meat_poultry', 'fish_seafood', 'deli',
      'pasta_tomato', 'rice_world_foods', 'breakfast', 'baking', 'oils_spices',
      'condiments', 'canned_jars', 'ready_meals', 'snacks', 'sweets',
      'cold_drinks', 'hot_drinks', 'alcohol', 'frozen', 'baby', 'pets',
      'household', 'personal_care', 'other', 'produce', 'convenience',
      'hot_beverages', 'pantry_staples', 'cooking_baking', 'canned_sauces',
      'beverages', 'drugstore', 'baby_kids', 'pet_supplies', 'deli_cold_cuts',
      'plant_based', 'dairy_eggs', 'checkout', 'deli_meat', 'pantry_canned',
      'pantry_dry', 'dairy'
    )
  ),
  quantity numeric(10, 3) check (quantity is null or quantity > 0),
  unit text check (
    unit is null
    or unit in ('g', 'kg', 'ml', 'l', 'piece', 'package', 'portion')
  ),
  package_size numeric(10, 3) check (package_size is null or package_size > 0),
  package_size_unit text check (
    package_size_unit is null
    or package_size_unit in ('g', 'kg', 'ml', 'l', 'piece', 'portion')
  ),
  line_total_cents bigint check (line_total_cents >= 0),
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'confirmed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint receipt_items_receipt_household_fkey
    foreign key (receipt_id, household_id)
    references public.purchase_receipts (id, household_id)
    on delete cascade,
  constraint receipt_items_package_size_complete
    check ((package_size is null) = (package_size_unit is null))
);

comment on table public.purchase_receipt_items is
  'Normalisierte Produktposition eines Receipts. Rabatte, Coupons, Pfand und Treuekarten sind keine Items.';

create index if not exists receipt_items_receipt_id_idx
  on public.purchase_receipt_items (receipt_id);
create index if not exists receipt_items_household_updated_idx
  on public.purchase_receipt_items (household_id, updated_at);
create index if not exists receipt_items_product_id_idx
  on public.purchase_receipt_items (product_id);
create unique index if not exists receipt_items_active_position_key
  on public.purchase_receipt_items (receipt_id, position)
  where deleted_at is null;

create or replace trigger receipt_items_set_updated_at
  before update on public.purchase_receipt_items
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------- Storage-Index
create table if not exists public.receipt_assets (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  household_id uuid not null references public.households (id) on delete cascade,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 5242880),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint receipt_assets_receipt_household_fkey
    foreign key (receipt_id, household_id)
    references public.purchase_receipts (id, household_id)
    on delete cascade,
  constraint receipt_assets_storage_path_key unique (storage_path),
  constraint receipt_assets_storage_path_shape check (
    (
      mime_type = 'image/jpeg'
      and (
        storage_path = household_id::text || '/' || receipt_id::text || '/' || id::text || '.jpg'
        or storage_path = household_id::text || '/' || receipt_id::text || '/' || id::text || '.jpeg'
      )
    )
    or (
      mime_type = 'image/png'
      and storage_path = household_id::text || '/' || receipt_id::text || '/' || id::text || '.png'
    )
    or (
      mime_type = 'image/webp'
      and storage_path = household_id::text || '/' || receipt_id::text || '/' || id::text || '.webp'
    )
  )
);

comment on table public.receipt_assets is
  'Serverseitiger Index fuer private Receipt-Bilder. Keine SQLite-/Realtime-Entity und keine oeffentliche URL.';

create index if not exists receipt_assets_receipt_id_idx
  on public.receipt_assets (receipt_id);
create index if not exists receipt_assets_household_updated_idx
  on public.receipt_assets (household_id, created_at);
create unique index if not exists receipt_assets_active_sort_order_key
  on public.receipt_assets (receipt_id, sort_order)
  where deleted_at is null;

-- ----------------------------------------------------------- Fachliche Guards
-- Die RLS-Policy bindet den Haushalt. Diese Trigger binden die actor-Spalten
-- zusaetzlich an den aktuellen Nutzer und verhindern spaetere Umschreibungen.
create or replace function private.guard_receipt_created_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  -- Trusted server writes have no auth.uid() and are not durch Client-RLS
  -- erreichbar. Authenticated clients must use their own actor id.
  if uid is null then
    return new;
  end if;

  if tg_op = 'INSERT' and new.created_by is distinct from uid then
    raise exception using
      errcode = '42501',
      message = 'created_by muss auth.uid() entsprechen';
  end if;

  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception using
      errcode = '42501',
      message = 'created_by darf nicht geaendert werden';
  end if;

  return new;
end;
$$;

create or replace function private.guard_receipt_confirmation_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    return new;
  end if;

  if tg_op = 'INSERT'
     and new.confirmed_by is not null
     and new.confirmed_by is distinct from uid then
    raise exception using
      errcode = '42501',
      message = 'confirmed_by muss beim Setzen auth.uid() entsprechen';
  end if;

  if tg_op = 'UPDATE'
     and new.confirmed_by is distinct from old.confirmed_by
     and new.confirmed_by is not null
     and new.confirmed_by is distinct from uid then
    raise exception using
      errcode = '42501',
      message = 'confirmed_by muss beim Setzen auth.uid() entsprechen';
  end if;

  return new;
end;
$$;

create or replace function private.validate_receipt_store()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.store_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.stores
    where id = new.store_id
      and household_id = new.household_id
      and deleted_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'store_id muss auf einen aktiven Markt desselben Haushalts zeigen';
  end if;

  return new;
end;
$$;

create or replace trigger receipts_guard_created_by
  before insert or update on public.purchase_receipts
  for each row
  execute function private.guard_receipt_created_by();

create or replace trigger receipts_guard_confirmation_actor
  before insert or update on public.purchase_receipts
  for each row
  execute function private.guard_receipt_confirmation_actor();

create or replace trigger receipts_validate_store
  before insert or update on public.purchase_receipts
  for each row
  execute function private.validate_receipt_store();

create or replace trigger receipt_assets_guard_created_by
  before insert or update on public.receipt_assets
  for each row
  execute function private.guard_receipt_created_by();

-- ------------------------------------------------------------------------- RLS
alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_items enable row level security;
alter table public.receipt_assets enable row level security;

create policy receipts_select_member on public.purchase_receipts
  for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy receipts_insert_member on public.purchase_receipts
  for insert to authenticated
  with check (
    (select private.is_household_member(household_id))
    and (select auth.uid()) = created_by
  );

create policy receipts_update_member on public.purchase_receipts
  for update to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy receipt_items_select_member on public.purchase_receipt_items
  for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy receipt_items_insert_member on public.purchase_receipt_items
  for insert to authenticated
  with check ((select private.is_household_member(household_id)));

create policy receipt_items_update_member on public.purchase_receipt_items
  for update to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy receipt_assets_select_member on public.receipt_assets
  for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy receipt_assets_insert_member on public.receipt_assets
  for insert to authenticated
  with check (
    (select private.is_household_member(household_id))
    and (select auth.uid()) = created_by
  );

create policy receipt_assets_update_member on public.receipt_assets
  for update to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy receipt_assets_delete_member on public.receipt_assets
  for delete to authenticated
  using ((select private.is_household_member(household_id)));

-- Die Tabellen werden direkt hier explizit freigegeben, weil der globale
-- Privilege-Owner 20_privileges.sql ausserhalb des Bead-Scope liegt. Anon
-- bekommt keinen Tabellenpfad; service_role bleibt fuer Serververarbeitung
-- voll berechtigt und umgeht RLS wie bei den bestehenden Tabellen.
revoke all on public.purchase_receipts, public.purchase_receipt_items, public.receipt_assets
  from anon, authenticated, service_role;

grant select, insert, update on public.purchase_receipts, public.purchase_receipt_items
  to authenticated;
grant select, insert, update, delete on public.receipt_assets
  to authenticated;
grant select, insert, update, delete on public.purchase_receipts, public.purchase_receipt_items, public.receipt_assets
  to service_role;
