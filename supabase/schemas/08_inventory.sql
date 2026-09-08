-- Gewuenschter Endzustand — NICHT von Hand migrieren (#39, #40).
--
-- Kuehlschrank-Bestand und Einkaufsliste. Beide sind geteilte Haushaltsdaten
-- und tragen die Sync-Spalten aus #42 von Anfang an: nachtraeglich einzuziehen
-- waere deutlich teurer, weil dann bereits Daten existieren.
--
-- `deleted_at` statt harter Deletes ist keine Vorsicht, sondern Voraussetzung
-- fuer Offline-Sync: Ein Client, der waehrend des Loeschens offline war, kann
-- sonst nicht unterscheiden zwischen "geloescht" und "noch nie gesehen" — und
-- legt den Datensatz beim naechsten Push wieder an.

-- ------------------------------------------------------------------ Lagerorte
create table if not exists public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  kind text not null check (kind in ('fridge', 'freezer', 'pantry', 'custom')),
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Wie bei fridge_items: Ein hart geloeschter Lagerort waere fuer einen
  -- Client, der waehrend des Loeschens offline war, nicht von "noch nie
  -- gesehen" zu unterscheiden — er legte ihn beim naechsten Push wieder an.
  -- Die Tabelle ist Spiegeltabelle der Offline-Engine (#45) und braucht den
  -- Tombstone deshalb genauso.
  deleted_at timestamptz
);

create index if not exists storage_locations_household_id_idx
  on public.storage_locations (household_id);

-- Inkrementeller Pull der Sync-Engine (#47), analog zu fridge_items.
create index if not exists storage_locations_household_updated_idx
  on public.storage_locations (household_id, updated_at);

create or replace trigger storage_locations_set_updated_at
  before update on public.storage_locations
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------------------- Bestand
create table if not exists public.fridge_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  location_id uuid references public.storage_locations (id) on delete set null,

  -- Nullable: Es muss auch "Reste vom Sonntag" ohne Produktbezug gehen.
  product_id uuid references public.products (id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 200),

  quantity bigint not null default 1000 check (quantity >= 0),
  unit text not null default 'piece'
    check (unit in ('g', 'kg', 'ml', 'l', 'piece', 'package', 'portion')),
  expiry_date date,

  added_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Snapshot des Packungsinhalts, z. B. 500 g bei "2 Packungen Haferflocken".
  -- Nullable fuer lose Ware und bestehende Datensaetze ohne bekannte Groesse.
  package_size bigint check (package_size > 0),
  package_size_unit text
    check (package_size_unit in ('g', 'kg', 'ml', 'l', 'piece', 'portion')),
  constraint fridge_items_package_size_complete
    check ((package_size is null) = (package_size_unit is null)),
  opened_at timestamptz,
  vacuum_sealed boolean not null default false,
  expiry_user_set boolean not null default false
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

-- Inkrementeller Pull der Sync-Engine: "alles, was sich seit lastSyncedAt
-- geaendert hat" (#47). Ohne diesen Index waere das ein Full Scan pro Sync.
create index if not exists fridge_items_household_updated_idx
  on public.fridge_items (household_id, updated_at);

-- Ablaufende Artikel fuer Dashboard und Erinnerungen (#71, #72, #73).
-- Partiell: geloeschte und undatierte Zeilen liegen nicht im Index.
create index if not exists fridge_items_expiry_idx
  on public.fridge_items (household_id, expiry_date)
  where deleted_at is null and expiry_date is not null;

-- Vorhandene MHD-Werte waren vor diesem Modul immer manuell gesetzt.
update public.fridge_items
set expiry_user_set = true
where expiry_date is not null;

-- ---------------------------------------------------------- Bestandsverlauf
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid,
  household_id uuid not null references public.households (id) on delete cascade,
  fridge_item_id uuid references public.fridge_items (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  actor uuid references public.profiles (id) on delete set null,
  type text not null check (type in ('in', 'out', 'waste', 'open')),
  quantity bigint not null check (quantity > 0),
  location_id uuid references public.storage_locations (id) on delete set null,
  reason text check (reason in ('expired', 'spoiled', 'other')),
  constraint transactions_reason_matches_waste
    check ((type = 'waste') = (reason is not null)),
  previous_expiry_date date,
  constraint transactions_previous_expiry_only_for_open
    check (previous_expiry_date is null or type = 'open'),
  origin_item_id uuid references public.fridge_items (id) on delete set null,
  origin_quantity bigint check (origin_quantity > 0),
  constraint transactions_split_origin_complete
    check ((origin_item_id is null) = (origin_quantity is null)),
  constraint transactions_split_origin_only_for_open
    check (origin_item_id is null or type = 'open'),
  constraint transactions_operation_id_move_type
    check (operation_id is null or type in ('in', 'out')),
  notes text check (notes is null or length(notes) <= 500),
  undone boolean not null default false,
  created_at timestamptz not null default now(),
  -- Monotone server-side insertion order. `created_at` remains the business
  -- event time and must not be used as an incremental sync cursor because an
  -- offline client can upload an older event after a newer one.
  sync_sequence bigint generated by default as identity,
  -- Bei einer Einzelbuchung verweist reversal_of auf die ursprüngliche
  -- Transaktion. Bei einer gruppierten Move-Gegenbuchung verweist es auf die
  -- ursprüngliche operation_id. Der Ursprung selbst bleibt unverändert.
  reversal_of uuid
);

comment on table public.transactions is
  'Ledger jeder Bestandsbewegung. Transaktionen werden angehängt, nie editiert.';

create index if not exists transactions_household_id_idx
  on public.transactions (household_id);
create index if not exists transactions_fridge_item_id_idx
  on public.transactions (fridge_item_id);
create index if not exists transactions_household_created_idx
  on public.transactions (household_id, created_at);
create index if not exists transactions_household_sync_sequence_idx
  on public.transactions (household_id, sync_sequence);
create index if not exists transactions_reversal_of_idx
  on public.transactions (reversal_of);
create unique index if not exists transactions_single_reversal_idx
  on public.transactions (household_id, reversal_of)
  where reversal_of is not null and operation_id is null;
create unique index if not exists transactions_move_reversal_type_idx
  on public.transactions (household_id, reversal_of, type)
  where reversal_of is not null and operation_id is not null;
create unique index if not exists transactions_operation_type_idx
  on public.transactions (operation_id, type)
  where operation_id is not null;

-- Identity-Sequenzen vergeben Werte vor dem Commit. Zwei parallele Inserts
-- können deshalb ihre Werte in umgekehrter Reihenfolge sichtbar machen. Der
-- Trigger serialisiert die endgültige Vergabe über einen transaction-scoped
-- Advisory-Lock. Die Identity-Sequenz bleibt absichtlich erhalten: Ihr
-- Default-Wert wird im Trigger durch den Wert nach dem Lock ersetzt; die dabei
-- entstehenden Lücken sind für einen Cursor unproblematisch.
create or replace function private.assign_transaction_sync_sequence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(41823017);
  new.sync_sequence := pg_catalog.nextval(
    pg_catalog.pg_get_serial_sequence('public.transactions', 'sync_sequence')
  );
  return new;
end;
$$;

create or replace trigger transactions_assign_sync_sequence
  before insert on public.transactions
  for each row
  execute function private.assign_transaction_sync_sequence();

comment on column public.transactions.operation_id is
  'Gemeinsame Provenienz fuer eine atomare Mehrzeilenmutation, z. B. einen Move.';
comment on column public.transactions.origin_item_id is
  'Unveraenderliche Ursprungszeile eines gesplitteten Open-Lots.';
comment on column public.transactions.origin_quantity is
  'Menge der Ursprungszeile vor dem Split, fuer einen sicheren Undo.';

create or replace trigger fridge_items_set_updated_at
  before update on public.fridge_items
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------------------- Maerkte
-- Frei verwaltbar pro Haushalt statt fest auf deutsche Ketten verdrahtet —
-- die App bietet REWE/Aldi/Lidl/... nur als Anlege-Presets in der UI an
-- (siehe store-presets.ts), das Schema kennt sie nicht.
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  color text not null default '#6B7280' check (color ~* '^#[0-9a-f]{6}$'),
  sort_order integer not null default 0,
  -- Marktspezifische Laufstrecke: kommagetrennte Liste von Kategorie-IDs aus
  -- shopping-categories.ts, vom Nutzer per Drag&Drop editierbar. NULL/leer
  -- bedeutet Standardreihenfolge. Bewusst pro Markt statt global, damit die
  -- Reihenfolge des einen Supermarkts nicht die eines anderen mitreisst; als
  -- normale Spalte der bereits synchronisierten `stores`-Zeile automatisch
  -- haushaltsweit geteilt.
  category_order text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Einkaufsmenge und Packungsinhalt bleiben getrennt:
  -- quantity=2, unit='package', package_size=500, package_size_unit='g'.
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

-- ------------------------------------------------------------- Einkaufsliste
create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 200),

  quantity numeric(10, 3) not null default 1 check (quantity >= 0),
  unit text not null default 'piece'
    check (unit in ('g', 'kg', 'ml', 'l', 'piece', 'package', 'portion')),
  -- Stabile IDs statt lokalisierter Labels. Die drei Werte sind ein Snapshot:
  -- spaetere Regel-/OFF-Aenderungen kategorisieren bestehende Eintraege nicht
  -- automatisch neu (#223).
  category_id text check (
    category_id in (
      'fresh_produce', 'bakery', 'chilled_dairy_eggs', 'ambient_milk_drinks',
      'chilled_plant_based', 'meat_poultry', 'fish_seafood', 'deli',
      'pasta_tomato', 'rice_world_foods', 'breakfast', 'baking', 'oils_spices',
      'condiments', 'canned_jars', 'ready_meals', 'snacks', 'sweets',
      'cold_drinks', 'hot_drinks', 'alcohol', 'frozen', 'baby', 'pets',
      'household', 'personal_care', 'other',
      -- Legacy-IDs zur Abwaertskompatibilitaet
      'produce', 'convenience', 'hot_beverages', 'pantry_staples', 'cooking_baking',
      'canned_sauces', 'beverages', 'drugstore', 'baby_kids', 'pet_supplies',
      'deli_cold_cuts', 'plant_based', 'dairy_eggs', 'checkout',
      -- Legacy-IDs zur Abwaertskompatibilitaet
      'deli_meat', 'pantry_canned', 'pantry_dry', 'dairy'
    )
  ),
  category_source text check (
    category_source in ('user', 'store_preference', 'household_preference', 'off_taxonomy', 'name_fallback')
  ),
  category_classifier_version text check (
    category_classifier_version is null
    or length(trim(category_classifier_version)) between 1 and 100
  ),
  sort_index integer not null default 0,

  -- Optional: ohne Marktzuordnung landet der Artikel in der "Ohne Markt"-
  -- Gruppe der UI. on delete set null statt cascade — ein geloeschter Markt
  -- soll den Artikel nicht mitreissen.
  store_id uuid references public.stores (id) on delete set null,
  -- Manuelle Schaetzung, kein automatischer Preisvergleich (siehe #16).
  price_estimate numeric(10, 2) check (price_estimate >= 0),

  -- Denormalisierter Titel-Snapshot statt FK auf recipes: Ein Artikel kann
  -- aus mehreren Rezepten desselben Wochenplans stammen (derselbe Zutatenbedarf
  -- wird ueber alle Rezepte aggregiert, bevor er hier landet, siehe
  -- use-shopping-needs.ts), eine einzelne recipe_id koennte das nicht
  -- abbilden. Snapshot statt Live-Join, damit ein spaeter umbenanntes oder
  -- geloeschtes Rezept die Anzeige "fuer welches Gericht" nicht verliert.
  recipe_names text[] not null default '{}',

  -- Zeitstempel statt Boolean: Beim "Einkauf abschliessen" (Phase 2) ist damit
  -- rekonstruierbar, was zu diesem Einkauf gehoerte. Ausserdem laesst sich ein
  -- Zeitstempel per Last-Write-Wins mergen, ein Boolean nicht sinnvoll.
  checked_at timestamptz,
  checked_by uuid references public.profiles (id) on delete set null,
  added_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Einkaufsmenge und Packungsinhalt bleiben getrennt:
  -- quantity=2, unit='package', package_size=500, package_size_unit='g'.
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

-- ------------------------ Standard-Lagerorte & Standard-Märkte beim Anlegen
-- create_household() wird erweitert: Ein Haushalt ohne Lagerorte oder Märkte
-- wäre eine Sackgasse — der Nutzer müsste sonst erst alles selbst anlegen.
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

-- Eine Mengenänderung wird als Delta gegen den aktuellen Serverbestand
-- verbucht. Die Zeile wird gesperrt, damit parallele Offline-Pushes nicht
-- denselben absoluten Wert überschreiben. operation_id macht den Aufruf nach
-- einem verlorenen HTTP-Response idempotent.
create or replace function public.adjust_fridge_item_quantity(
  p_operation_id uuid,
  p_transaction_id uuid,
  p_item_id uuid,
  p_household_id uuid,
  p_delta bigint,
  p_created_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_item public.fridge_items%rowtype;
  existing_transaction public.transactions%rowtype;
  expected_type text;
  expected_quantity bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Nicht angemeldet';
  end if;
  if p_operation_id is null
    or p_transaction_id is null
    or p_item_id is null
    or p_household_id is null
    or p_delta is null
    or p_created_at is null
    or p_delta = 0 then
    raise exception 'Mengen-Payload ist unvollstaendig oder ungueltig';
  end if;

  expected_type := case when p_delta > 0 then 'in' else 'out' end;
  expected_quantity := abs(p_delta);

  -- Der Lock serialisiert Deltas desselben Bestands. Auch ein Idempotenz-
  -- Retry wartet damit auf einen eventuell noch laufenden Erstaufruf.
  select * into current_item
  from public.fridge_items
  where id = p_item_id and household_id = p_household_id
  for update;
  if not found then
    raise exception 'Bestand nicht gefunden oder keine Berechtigung';
  end if;

  select * into existing_transaction
  from public.transactions
  where household_id = p_household_id and operation_id = p_operation_id;
  if found then
    if existing_transaction.id is distinct from p_transaction_id
      or existing_transaction.fridge_item_id is distinct from p_item_id
      or existing_transaction.type is distinct from expected_type
      or existing_transaction.quantity is distinct from expected_quantity then
      -- Idempotenz bezieht sich auf den ursprünglichen Ledger-Nachweis. Der
      -- Bestand darf sich seit dem ersten erfolgreichen Aufruf weiter bewegt
      -- oder mit einem anderen Produktbezug angereichert haben.
      raise exception 'Mengenoperation % passt nicht zum vorhandenen Ledger', p_operation_id;
    end if;
    return current_item.id;
  end if;

  if exists (
    select 1
    from public.transactions
    where id = p_transaction_id
  ) then
    raise exception 'Ledger-ID % ist bereits vergeben', p_transaction_id;
  end if;

  if current_item.deleted_at is not null then
    raise exception 'Geloeschter Bestand kann nicht mengenveraendert werden';
  end if;
  if current_item.quantity + p_delta < 0 then
    raise exception 'Bestand kann nicht unter null sinken';
  end if;

  update public.fridge_items
  set quantity = current_item.quantity + p_delta,
      deleted_at = case
        when current_item.quantity + p_delta = 0 then now()
        else null
      end
  where id = p_item_id;

  insert into public.transactions (
    id, operation_id, household_id, fridge_item_id, product_id, actor, type,
    quantity, location_id, reason, previous_expiry_date, notes, undone, created_at
  )
  values (
    p_transaction_id, p_operation_id, p_household_id, p_item_id,
    current_item.product_id, (select auth.uid()), expected_type,
    expected_quantity, current_item.location_id, null, null, null, false,
    p_created_at
  );

  return current_item.id;
end;
$$;

-- Eine manuelle Mengenkorrektur ist ein Compare-and-set gegen die Menge, die
-- der Bearbeitungsdialog geladen hat. So kann ein spaeter Offline-Push keinen
-- zwischenzeitlichen Verbrauch eines anderen Geraets ueberschreiben.
create or replace function public.correct_fridge_item_quantity(
  p_operation_id uuid,
  p_transaction_id uuid,
  p_item_id uuid,
  p_household_id uuid,
  p_expected_quantity bigint,
  p_new_quantity bigint,
  p_created_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_item public.fridge_items%rowtype;
  expected_type text;
  correction_quantity bigint;
  existing_count integer;
  existing_matches integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Nicht angemeldet';
  end if;
  if p_operation_id is null
    or p_transaction_id is null
    or p_item_id is null
    or p_household_id is null
    or p_expected_quantity is null
    or p_new_quantity is null
    or p_created_at is null then
    raise exception 'Mengenkorrektur-Payload ist unvollstaendig oder ungueltig';
  end if;
  if p_expected_quantity < 0
    or p_new_quantity < 0
    or p_expected_quantity = p_new_quantity then
    raise exception 'Mengenkorrektur braucht zwei unterschiedliche, nicht negative Mengen';
  end if;

  expected_type := case when p_new_quantity > p_expected_quantity then 'in' else 'out' end;
  correction_quantity := abs(p_new_quantity - p_expected_quantity);

  select * into current_item
  from public.fridge_items
  where id = p_item_id and household_id = p_household_id
  for update;
  if not found then
    raise exception 'Bestand nicht gefunden oder keine Berechtigung';
  end if;

  select count(*)::int into existing_count
  from public.transactions
  where household_id = p_household_id and operation_id = p_operation_id;
  if existing_count > 0 then
    select count(*)::int into existing_matches
    from public.transactions
    where id = p_transaction_id
      and household_id = p_household_id
      and operation_id = p_operation_id
      and fridge_item_id = p_item_id
      and type = expected_type
      and quantity = correction_quantity
      and notes = '[Manual correction]';
    if existing_count <> 1 or existing_matches <> 1 then
      raise exception 'Mengenkorrektur % passt nicht zum vorhandenen Ledger', p_operation_id;
    end if;
    return current_item.id;
  end if;

  if exists (select 1 from public.transactions where id = p_transaction_id) then
    raise exception 'Ledger-ID % ist bereits vergeben', p_transaction_id;
  end if;
  if current_item.deleted_at is not null then
    raise exception 'Geloeschter Bestand kann nicht mengenkorrigiert werden';
  end if;
  if current_item.quantity is distinct from p_expected_quantity then
    raise exception 'Bestandsmenge wurde zwischenzeitlich geaendert';
  end if;

  update public.fridge_items
  set quantity = p_new_quantity,
      deleted_at = case when p_new_quantity = 0 then now() else null end
  where id = p_item_id;

  insert into public.transactions (
    id, operation_id, household_id, fridge_item_id, product_id, actor, type,
    quantity, location_id, reason, previous_expiry_date, notes, undone, created_at
  )
  values (
    p_transaction_id, p_operation_id, p_household_id, p_item_id,
    current_item.product_id, (select auth.uid()), expected_type,
    correction_quantity, current_item.location_id, null, null,
    '[Manual correction]', false, p_created_at
  );

  return current_item.id;
end;
$$;

-- Gegenbuchung einer einzelnen in/out/waste-Transaktion. Bestand und neues
-- Ledger-Event werden in derselben Datenbanktransaktion geschrieben. Der
-- Zeilen-Lock plus der eindeutige reversal_of-Vertrag verhindert doppeltes
-- Undo durch zwei Geraete.
create or replace function public.reverse_inventory_quantity_transaction(
  p_reversal_transaction_id uuid,
  p_reversal_of uuid,
  p_item_id uuid,
  p_household_id uuid,
  p_created_at timestamptz,
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  original_transaction public.transactions%rowtype;
  current_item public.fridge_items%rowtype;
  inverse_type text;
  result_quantity bigint;
  existing_count integer;
  existing_matches integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Nicht angemeldet';
  end if;
  if p_reversal_transaction_id is null
    or p_reversal_of is null
    or p_item_id is null
    or p_household_id is null
    or p_created_at is null
    or p_notes is null
    or length(p_notes) > 500 then
    raise exception 'Mengen-Undo-Payload ist unvollstaendig oder ungueltig';
  end if;

  select * into original_transaction
  from public.transactions
  where id = p_reversal_of and household_id = p_household_id;
  if not found
    or original_transaction.fridge_item_id is distinct from p_item_id
    or original_transaction.reversal_of is not null
    or original_transaction.type not in ('in', 'out', 'waste') then
    raise exception 'Ursprungsbuchung ist unvollstaendig oder nicht umkehrbar';
  end if;
  inverse_type := case when original_transaction.type = 'in' then 'out' else 'in' end;

  select * into current_item
  from public.fridge_items
  where id = p_item_id and household_id = p_household_id
  for update;
  if not found then
    raise exception 'Bestand nicht gefunden oder keine Berechtigung';
  end if;

  select count(*)::int into existing_count
  from public.transactions
  where household_id = p_household_id
    and reversal_of = p_reversal_of
    and operation_id is null;
  if existing_count > 0 then
    select count(*)::int into existing_matches
    from public.transactions
    where id = p_reversal_transaction_id
      and household_id = p_household_id
      and reversal_of = p_reversal_of
      and operation_id is null
      and fridge_item_id = p_item_id
      and type = inverse_type
      and quantity = original_transaction.quantity
      and notes = p_notes;
    if existing_count <> 1 or existing_matches <> 1 then
      raise exception 'Buchung % wurde bereits rueckgaengig gemacht', p_reversal_of;
    end if;
    return current_item.id;
  end if;

  if exists (select 1 from public.transactions where id = p_reversal_transaction_id) then
    raise exception 'Ledger-ID % ist bereits vergeben', p_reversal_transaction_id;
  end if;

  if current_item.deleted_at is not null then
    if original_transaction.type = 'in' then
      raise exception 'Der Bestand wurde zwischenzeitlich veraendert';
    end if;
    if original_transaction.type = 'out'
      and original_transaction.operation_id is not null
      and current_item.quantity = 0 then
      result_quantity := original_transaction.quantity;
    elsif current_item.quantity is distinct from original_transaction.quantity then
      raise exception 'Der Bestand wurde zwischenzeitlich veraendert';
    else
      result_quantity := current_item.quantity;
    end if;
  else
    result_quantity := current_item.quantity + case
      when inverse_type = 'out' then -original_transaction.quantity
      else original_transaction.quantity
    end;
    if result_quantity < 0 then
      raise exception 'Die Gegenbuchung wuerde eine negative Bestandsmenge erzeugen';
    end if;
  end if;

  update public.fridge_items
  set quantity = result_quantity,
      deleted_at = case when result_quantity = 0 then now() else null end
  where id = p_item_id;

  insert into public.transactions (
    id, operation_id, reversal_of, household_id, fridge_item_id, product_id,
    actor, type, quantity, location_id, reason, previous_expiry_date, notes,
    undone, created_at
  )
  values (
    p_reversal_transaction_id, null, p_reversal_of, p_household_id, p_item_id,
    coalesce(original_transaction.product_id, current_item.product_id),
    (select auth.uid()), inverse_type, original_transaction.quantity,
    coalesce(current_item.location_id, original_transaction.location_id),
    null, null, p_notes, false, p_created_at
  );

  return current_item.id;
end;
$$;

-- Ein Move veraendert den Bestand und schreibt zwei append-only Ledgerzeilen.
-- Die Funktion bleibt SECURITY INVOKER, damit die bestehenden RLS-Policies auch
-- fuer den RPC gelten. Die Operation ist absichtlich eine einzelne
-- Datenbankfunktion: PostgreSQL rollt bei einem Fehler alle Statements dieses
-- Aufrufs gemeinsam zurueck. Siehe https://supabase.com/docs/guides/database/functions
-- und https://www.postgresql.org/docs/17/tutorial-transactions.html.
create or replace function public.move_fridge_item(
  p_operation_id uuid,
  p_item_id uuid,
  p_household_id uuid,
  p_expected_location_id uuid,
  p_new_location_id uuid,
  p_expected_quantity bigint,
  p_out_transaction_id uuid,
  p_in_transaction_id uuid,
  p_created_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_item public.fridge_items%rowtype;
  existing_count integer;
  out_matches integer;
  in_matches integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Nicht angemeldet';
  end if;
  if p_operation_id is null
    or p_item_id is null
    or p_household_id is null
    or p_expected_quantity is null
    or p_out_transaction_id is null
    or p_in_transaction_id is null
    or p_created_at is null then
    raise exception 'Move-Payload ist unvollstaendig';
  end if;
  if p_out_transaction_id = p_in_transaction_id then
    raise exception 'Move braucht zwei unterschiedliche Ledger-IDs';
  end if;
  if p_expected_quantity <= 0 then
    raise exception 'Move-Mengen muessen positiv sein';
  end if;

  -- FOR UPDATE serialisiert konkurrierende Moves desselben Bestandseintrags.
  -- Der Select unter SECURITY INVOKER wird weiterhin durch fridge_items-RLS
  -- auf Haushaltsmitglieder begrenzt.
  select * into current_item
  from public.fridge_items
  where id = p_item_id and household_id = p_household_id
  for update;
  if not found then
    raise exception 'Bestand nicht gefunden oder keine Berechtigung';
  end if;

  -- Nach einem verlorenen HTTP-Response existiert die Operation bereits. Die
  -- beiden Ledgerzeilen bilden zusammen den Idempotenznachweis. Ein einzelnes
  -- oder inhaltlich anderes Leg darf nie stillschweigend als Erfolg gelten.
  select count(*)::int into existing_count
  from public.transactions
  where household_id = p_household_id and operation_id = p_operation_id;
  if existing_count > 0 then
    if existing_count <> 2 then
      raise exception 'Move % ist unvollstaendig', p_operation_id;
    end if;

    select count(*)::int into out_matches
    from public.transactions
    where id = p_out_transaction_id
      and household_id = p_household_id
      and operation_id = p_operation_id
      and fridge_item_id = p_item_id
      and type = 'out'
      and location_id is not distinct from p_expected_location_id
      and quantity = p_expected_quantity;

    select count(*)::int into in_matches
    from public.transactions
    where id = p_in_transaction_id
      and household_id = p_household_id
      and operation_id = p_operation_id
      and fridge_item_id = p_item_id
      and type = 'in'
      and location_id is not distinct from p_new_location_id
      and quantity = p_expected_quantity;

    if out_matches <> 1 or in_matches <> 1 then
      raise exception 'Move % passt nicht zum vorhandenen Ledger', p_operation_id;
    end if;
    return current_item.id;
  end if;

  if current_item.deleted_at is not null then
    raise exception 'Geloeschter Bestand kann nicht verschoben werden';
  end if;
  if current_item.location_id is not distinct from p_new_location_id then
    raise exception 'Neuer Lagerort entspricht dem bisherigen Lagerort';
  end if;
  if current_item.location_id is distinct from p_expected_location_id then
    raise exception 'Bestand wurde zwischenzeitlich an einen anderen Lagerort verschoben';
  end if;
  if current_item.quantity is distinct from p_expected_quantity then
    raise exception 'Bestandsmenge wurde zwischenzeitlich geaendert';
  end if;
  if p_new_location_id is not null and not exists (
    select 1
    from public.storage_locations
    where id = p_new_location_id and household_id = p_household_id
  ) then
    raise exception 'Neuer Lagerort gehoert nicht zum Haushalt';
  end if;

  update public.fridge_items
  set location_id = p_new_location_id
  where id = p_item_id;

  insert into public.transactions (
    id, operation_id, household_id, fridge_item_id, product_id, actor, type,
    quantity, location_id, reason, previous_expiry_date, notes, undone, created_at
  )
  values (
    p_out_transaction_id, p_operation_id, p_household_id, p_item_id,
    current_item.product_id, (select auth.uid()), 'out', current_item.quantity,
    p_expected_location_id, null, null, null, false, p_created_at
  );

  insert into public.transactions (
    id, operation_id, household_id, fridge_item_id, product_id, actor, type,
    quantity, location_id, reason, previous_expiry_date, notes, undone, created_at
  )
  values (
    p_in_transaction_id, p_operation_id, p_household_id, p_item_id,
    current_item.product_id, (select auth.uid()), 'in', current_item.quantity,
    p_new_location_id, null, null, null, false, p_created_at
  );

  return current_item.id;
end;
$$;

-- Eine Undo-/Korrektur-Move-Gegenbuchung bleibt ebenso atomar wie der
-- ursprüngliche Move. Die gemeinsame reversal_of-Referenz ist die
-- ursprüngliche operation_id, weil ein Move aus zwei Ledgerzeilen besteht.
create or replace function public.reverse_move_fridge_item(
  p_operation_id uuid,
  p_reversal_of uuid,
  p_item_id uuid,
  p_household_id uuid,
  p_expected_location_id uuid,
  p_new_location_id uuid,
  p_expected_quantity bigint,
  p_out_transaction_id uuid,
  p_in_transaction_id uuid,
  p_created_at timestamptz,
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_item public.fridge_items%rowtype;
  existing_count integer;
  out_matches integer;
  in_matches integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Nicht angemeldet';
  end if;
  if p_operation_id is null
    or p_reversal_of is null
    or p_item_id is null
    or p_household_id is null
    or p_expected_quantity is null
    or p_out_transaction_id is null
    or p_in_transaction_id is null
    or p_created_at is null
    or p_notes is null then
    raise exception 'Undo-Move-Payload ist unvollstaendig';
  end if;
  if p_out_transaction_id = p_in_transaction_id then
    raise exception 'Undo-Move braucht zwei unterschiedliche Ledger-IDs';
  end if;
  if p_expected_quantity <= 0 then
    raise exception 'Undo-Move-Mengen muessen positiv sein';
  end if;

  select * into current_item
  from public.fridge_items
  where id = p_item_id and household_id = p_household_id
  for update;
  if not found then
    raise exception 'Bestand nicht gefunden oder keine Berechtigung';
  end if;

  select count(*)::int into existing_count
  from public.transactions
  where household_id = p_household_id and operation_id = p_operation_id;
  if existing_count > 0 then
    if existing_count <> 2 then
      raise exception 'Undo-Move % ist unvollstaendig', p_operation_id;
    end if;

    select count(*)::int into out_matches
    from public.transactions
    where id = p_out_transaction_id
      and household_id = p_household_id
      and operation_id = p_operation_id
      and reversal_of = p_reversal_of
      and fridge_item_id = p_item_id
      and type = 'out'
      and location_id is not distinct from p_expected_location_id
      and quantity = p_expected_quantity
      and notes = p_notes;

    select count(*)::int into in_matches
    from public.transactions
    where id = p_in_transaction_id
      and household_id = p_household_id
      and operation_id = p_operation_id
      and reversal_of = p_reversal_of
      and fridge_item_id = p_item_id
      and type = 'in'
      and location_id is not distinct from p_new_location_id
      and quantity = p_expected_quantity
      and notes = p_notes;

    if out_matches <> 1 or in_matches <> 1 then
      raise exception 'Undo-Move % passt nicht zum vorhandenen Ledger', p_operation_id;
    end if;
    return current_item.id;
  end if;

  if exists (
    select 1
    from public.transactions
    where household_id = p_household_id and reversal_of = p_reversal_of
  ) then
    raise exception 'Move % wurde bereits rückgängig gemacht', p_reversal_of;
  end if;

  if current_item.deleted_at is not null then
    raise exception 'Geloeschter Bestand kann nicht verschoben werden';
  end if;
  if current_item.location_id is distinct from p_expected_location_id then
    raise exception 'Bestand wurde zwischenzeitlich an einen anderen Lagerort verschoben';
  end if;
  if current_item.quantity is distinct from p_expected_quantity then
    raise exception 'Bestandsmenge wurde zwischenzeitlich geaendert';
  end if;
  if current_item.location_id is distinct from p_new_location_id
    and p_new_location_id is not null and not exists (
      select 1
      from public.storage_locations
      where id = p_new_location_id and household_id = p_household_id
    ) then
    raise exception 'Neuer Lagerort gehoert nicht zum Haushalt';
  end if;

  if current_item.location_id is not distinct from p_new_location_id then
    raise exception 'Neuer Lagerort entspricht dem bisherigen Lagerort';
  end if;

  update public.fridge_items
  set location_id = p_new_location_id
  where id = p_item_id;

  insert into public.transactions (
    id, operation_id, reversal_of, household_id, fridge_item_id, product_id,
    actor, type, quantity, location_id, reason, previous_expiry_date, notes,
    undone, created_at
  )
  values (
    p_out_transaction_id, p_operation_id, p_reversal_of, p_household_id,
    p_item_id, current_item.product_id, (select auth.uid()), 'out',
    current_item.quantity, p_expected_location_id, null, null, p_notes, false,
    p_created_at
  );

  insert into public.transactions (
    id, operation_id, reversal_of, household_id, fridge_item_id, product_id,
    actor, type, quantity, location_id, reason, previous_expiry_date, notes,
    undone, created_at
  )
  values (
    p_in_transaction_id, p_operation_id, p_reversal_of, p_household_id,
    p_item_id, current_item.product_id, (select auth.uid()), 'in',
    current_item.quantity, p_new_location_id, null, null, p_notes, false,
    p_created_at
  );

  return current_item.id;
end;
$$;

-- Ein Split-Öffnen erzeugt aus einem versiegelten Los zwei Zeilen: den
-- reduzierten Rest und das neue geöffnete Los, dazu die Ledgerzeile. Compare-
-- and-set gegen die vom Client geladene Ausgangsmenge verhindert, dass ein
-- später Offline-Push zwischenzeitlichen Verbrauch eines anderen Geräts
-- überschreibt; alle drei Schreibvorgänge sind eine Datenbanktransaktion.
create or replace function public.split_fridge_item_open(
  p_transaction_id uuid,
  p_source_item_id uuid,
  p_opened_item_id uuid,
  p_household_id uuid,
  p_expected_source_quantity bigint,
  p_open_quantity bigint,
  p_opened_at timestamptz,
  p_new_expiry_date date,
  p_expiry_user_set boolean,
  p_created_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_item public.fridge_items%rowtype;
  existing_transaction public.transactions%rowtype;
  remaining_quantity bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Nicht angemeldet';
  end if;
  if p_transaction_id is null
    or p_source_item_id is null
    or p_opened_item_id is null
    or p_household_id is null
    or p_expected_source_quantity is null
    or p_open_quantity is null
    or p_opened_at is null
    or p_expiry_user_set is null
    or p_created_at is null then
    raise exception 'Split-Payload ist unvollstaendig oder ungueltig';
  end if;
  if p_source_item_id = p_opened_item_id then
    raise exception 'Split braucht zwei unterschiedliche Bestands-IDs';
  end if;
  if p_expected_source_quantity <= 0 or p_open_quantity <= 0 then
    raise exception 'Ausgangs- und Öffnungsmenge muessen positiv sein';
  end if;
  if p_open_quantity > p_expected_source_quantity then
    raise exception 'Die Öffnungsmenge darf die Ausgangsmenge nicht uebersteigen';
  end if;

  -- Idempotenz ueber die Ledger-ID: ein Retry mit derselben Transaktion muss
  -- dieselbe Aufteilung wiedergeben, statt sie erneut auszufuehren.
  select * into existing_transaction from public.transactions where id = p_transaction_id;
  if found then
    if existing_transaction.type is distinct from 'open'
      or existing_transaction.fridge_item_id is distinct from p_opened_item_id
      or existing_transaction.origin_item_id is distinct from p_source_item_id
      or existing_transaction.quantity is distinct from p_open_quantity then
      raise exception 'Split-Operation % passt nicht zum vorhandenen Ledger', p_transaction_id;
    end if;
    return p_opened_item_id;
  end if;

  select * into source_item
  from public.fridge_items
  where id = p_source_item_id and household_id = p_household_id
  for update;
  if not found then
    raise exception 'Bestand nicht gefunden oder keine Berechtigung';
  end if;
  if source_item.deleted_at is not null then
    raise exception 'Geloeschter Bestand kann nicht geoeffnet werden';
  end if;
  if source_item.opened_at is not null then
    raise exception 'Ein bereits geoeffnetes Los kann nicht erneut geoeffnet werden';
  end if;
  if source_item.quantity is distinct from p_expected_source_quantity then
    raise exception 'Bestandsmenge wurde zwischenzeitlich geaendert';
  end if;
  if exists (select 1 from public.fridge_items where id = p_opened_item_id) then
    raise exception 'Geoeffnetes-Los-ID % ist bereits vergeben', p_opened_item_id;
  end if;

  remaining_quantity := source_item.quantity - p_open_quantity;

  update public.fridge_items
  set quantity = remaining_quantity,
      deleted_at = case when remaining_quantity = 0 then now() else null end
  where id = p_source_item_id;

  insert into public.fridge_items (
    id, household_id, location_id, product_id, name, quantity, unit,
    package_size, package_size_unit, expiry_date, added_by,
    opened_at, vacuum_sealed, expiry_user_set
  )
  values (
    p_opened_item_id, source_item.household_id, source_item.location_id,
    source_item.product_id, source_item.name, p_open_quantity, source_item.unit,
    source_item.package_size, source_item.package_size_unit, p_new_expiry_date,
    source_item.added_by, p_opened_at, source_item.vacuum_sealed, p_expiry_user_set
  );

  insert into public.transactions (
    id, household_id, fridge_item_id, product_id, actor, type, quantity,
    location_id, previous_expiry_date, origin_item_id, origin_quantity, notes,
    undone, created_at
  )
  values (
    p_transaction_id, p_household_id, p_opened_item_id, source_item.product_id,
    (select auth.uid()), 'open', p_open_quantity, source_item.location_id,
    source_item.expiry_date, p_source_item_id, source_item.quantity,
    '[Split] origin=' || p_source_item_id::text, false, p_created_at
  );

  return p_opened_item_id;
end;
$$;

-- Gegenstueck zu split_fridge_item_open: fuehrt versiegeltes Rest-Los und
-- geoeffnetes Los wieder zu einem Los zusammen. Beide Zeilen werden in
-- konsistenter Reihenfolge gesperrt, die Ausgangswerte gegen die
-- ursprüngliche Split-Buchung geprueft und Bestand plus Ledger atomar
-- committed — derselbe Compare-and-set-Schutz wie bei den anderen Undo-RPCs.
create or replace function public.merge_undo_fridge_item_open(
  p_reversal_transaction_id uuid,
  p_reversal_of uuid,
  p_household_id uuid,
  p_created_at timestamptz,
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  original_transaction public.transactions%rowtype;
  sealed_item public.fridge_items%rowtype;
  opened_item public.fridge_items%rowtype;
  first_id uuid;
  second_id uuid;
  existing_reversal public.transactions%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Nicht angemeldet';
  end if;
  if p_reversal_transaction_id is null
    or p_reversal_of is null
    or p_household_id is null
    or p_created_at is null
    or p_notes is null
    or length(p_notes) > 500 then
    raise exception 'Merge-Undo-Payload ist unvollstaendig oder ungueltig';
  end if;

  select * into original_transaction
  from public.transactions
  where id = p_reversal_of and household_id = p_household_id;
  if not found
    or original_transaction.type is distinct from 'open'
    or original_transaction.origin_item_id is null
    or original_transaction.origin_quantity is null
    or original_transaction.fridge_item_id is null
    or original_transaction.reversal_of is not null then
    raise exception 'Ursprungsbuchung ist unvollstaendig oder kein umkehrbarer Split';
  end if;

  select * into existing_reversal
  from public.transactions
  where household_id = p_household_id and reversal_of = p_reversal_of and operation_id is null;
  if found then
    if existing_reversal.id is distinct from p_reversal_transaction_id
      or existing_reversal.fridge_item_id is distinct from original_transaction.fridge_item_id
      or existing_reversal.type is distinct from 'open'
      or existing_reversal.quantity is distinct from original_transaction.quantity
      or existing_reversal.notes is distinct from p_notes then
      raise exception 'Split-Öffnung % wurde bereits rueckgaengig gemacht', p_reversal_of;
    end if;
    return original_transaction.origin_item_id;
  end if;

  if exists (select 1 from public.transactions where id = p_reversal_transaction_id) then
    raise exception 'Ledger-ID % ist bereits vergeben', p_reversal_transaction_id;
  end if;

  -- Konsistente Sperrreihenfolge ueber zwei Zeilen verhindert Deadlocks mit
  -- einem gleichzeitigen Merge desselben Split-Paars.
  if original_transaction.origin_item_id < original_transaction.fridge_item_id then
    first_id := original_transaction.origin_item_id;
    second_id := original_transaction.fridge_item_id;
  else
    first_id := original_transaction.fridge_item_id;
    second_id := original_transaction.origin_item_id;
  end if;
  perform 1 from public.fridge_items where id = first_id and household_id = p_household_id for update;
  perform 1 from public.fridge_items where id = second_id and household_id = p_household_id for update;

  select * into sealed_item from public.fridge_items
  where id = original_transaction.origin_item_id and household_id = p_household_id;
  select * into opened_item from public.fridge_items
  where id = original_transaction.fridge_item_id and household_id = p_household_id;
  if sealed_item.id is null or opened_item.id is null then
    raise exception 'Split-Lose nicht mehr vorhanden';
  end if;

  -- Losidentitaet wie im Client (sameSplitIdentity, inventory-lifecycle.ts):
  -- Menge und Zeitstempel allein reichen nicht, weil ein Offline-Move oder
  -- eine Metadatenaenderung an einem der beiden Split-Lose sonst
  -- stillschweigend verworfen wuerde.
  if sealed_item.deleted_at is not null
    or opened_item.deleted_at is not null
    or opened_item.opened_at is null
    or sealed_item.opened_at is not null
    or sealed_item.quantity + opened_item.quantity is distinct from original_transaction.origin_quantity
    or opened_item.quantity is distinct from original_transaction.quantity
    or sealed_item.expiry_date is distinct from original_transaction.previous_expiry_date
    or sealed_item.location_id is distinct from opened_item.location_id
    or sealed_item.product_id is distinct from opened_item.product_id
    or sealed_item.name is distinct from opened_item.name
    or sealed_item.unit is distinct from opened_item.unit
    or sealed_item.package_size is distinct from opened_item.package_size
    or sealed_item.package_size_unit is distinct from opened_item.package_size_unit
    or sealed_item.added_by is distinct from opened_item.added_by
    or sealed_item.vacuum_sealed is distinct from opened_item.vacuum_sealed
  then
    raise exception 'Der Bestand wurde zwischenzeitlich veraendert';
  end if;

  update public.fridge_items
  set quantity = sealed_item.quantity + opened_item.quantity
  where id = sealed_item.id;

  update public.fridge_items
  set deleted_at = now()
  where id = opened_item.id;

  insert into public.transactions (
    id, household_id, fridge_item_id, product_id, actor, type, quantity,
    location_id, previous_expiry_date, notes, undone, reversal_of, created_at
  )
  values (
    p_reversal_transaction_id, p_household_id, original_transaction.fridge_item_id,
    original_transaction.product_id, (select auth.uid()), 'open',
    original_transaction.quantity, original_transaction.location_id,
    opened_item.expiry_date, p_notes, false, p_reversal_of, p_created_at
  );

  return sealed_item.id;
end;
$$;

-- ------------------------------------------------------------- Einkaufshistorie
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
      'fresh_produce', 'bakery', 'chilled_dairy_eggs', 'ambient_milk_drinks',
      'chilled_plant_based', 'meat_poultry', 'fish_seafood', 'deli',
      'pasta_tomato', 'rice_world_foods', 'breakfast', 'baking', 'oils_spices',
      'condiments', 'canned_jars', 'ready_meals', 'snacks', 'sweets',
      'cold_drinks', 'hot_drinks', 'alcohol', 'frozen', 'baby', 'pets',
      'household', 'personal_care', 'other',
      'produce', 'deli_meat', 'pantry_canned', 'pantry_dry', 'convenience',
      'hot_beverages', 'pantry_staples', 'cooking_baking', 'canned_sauces',
      'beverages', 'drugstore', 'baby_kids', 'pet_supplies', 'deli_cold_cuts',
      'plant_based', 'dairy_eggs', 'dairy', 'checkout'
    )
  ),
  category_source text check (
    category_source in ('user', 'store_preference', 'household_preference', 'off_taxonomy', 'name_fallback')
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

-- ------------------------------------------------------------------------- RLS
alter table public.storage_locations enable row level security;
alter table public.stores enable row level security;
alter table public.fridge_items enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.shopping_history enable row level security;
alter table public.transactions enable row level security;

-- Geteilte Haushaltsdaten: Jedes Mitglied darf alles. Die Grenze verlaeuft am
-- Haushalt, nicht an der Person — das ist der ganze Zweck des Features.
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

create policy transactions_select_member on public.transactions
  for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy transactions_insert_member on public.transactions
  for insert to authenticated
  with check ((select private.is_household_member(household_id)));

-- Keine UPDATE/DELETE-Policy: der append-only-Vertrag wird durch RLS erzwungen.
