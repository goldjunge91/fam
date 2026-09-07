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

  quantity numeric(10, 3) not null default 1 check (quantity >= 0),
  unit text not null default 'piece'
    check (unit in ('g', 'kg', 'ml', 'l', 'piece', 'package', 'portion')),
  expiry_date date,

  added_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Snapshot des Packungsinhalts, z. B. 500 g bei "2 Packungen Haferflocken".
  -- Nullable fuer lose Ware und bestehende Datensaetze ohne bekannte Groesse.
  package_size numeric(10, 3) check (package_size > 0),
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
  quantity numeric(10, 3) not null check (quantity > 0),
  location_id uuid references public.storage_locations (id) on delete set null,
  reason text check (reason in ('expired', 'spoiled', 'other')),
  constraint transactions_reason_matches_waste
    check ((type = 'waste') = (reason is not null)),
  previous_expiry_date date,
  constraint transactions_previous_expiry_only_for_open
    check (previous_expiry_date is null or type = 'open'),
  origin_item_id uuid references public.fridge_items (id) on delete set null,
  origin_quantity numeric(10, 3) check (origin_quantity > 0),
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
  p_delta numeric,
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
  expected_quantity numeric;
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
    or p_delta = 0
    or p_delta = 'NaN'::numeric then
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
  p_expected_quantity numeric,
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
  p_expected_quantity numeric,
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
