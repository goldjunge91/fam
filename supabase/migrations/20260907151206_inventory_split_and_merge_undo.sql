SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.merge_undo_fridge_item_open (
  p_reversal_transaction_id uuid,
  p_reversal_of             uuid,
  p_household_id            uuid,
  p_created_at              timestamp with time zone,
  p_notes                   text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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

  if sealed_item.deleted_at is not null
    or opened_item.deleted_at is not null
    or opened_item.opened_at is null
    or sealed_item.opened_at is not null
    or sealed_item.quantity + opened_item.quantity is distinct from original_transaction.origin_quantity
    or opened_item.quantity is distinct from original_transaction.quantity
    or sealed_item.expiry_date is distinct from original_transaction.previous_expiry_date
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
$function$;

CREATE OR REPLACE FUNCTION public.split_fridge_item_open (
  p_transaction_id           uuid,
  p_source_item_id           uuid,
  p_opened_item_id           uuid,
  p_household_id             uuid,
  p_expected_source_quantity numeric,
  p_open_quantity            numeric,
  p_opened_at                timestamp with time zone,
  p_new_expiry_date          date,
  p_expiry_user_set          boolean,
  p_created_at               timestamp with time zone
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  source_item public.fridge_items%rowtype;
  existing_transaction public.transactions%rowtype;
  remaining_quantity numeric;
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
  if p_expected_source_quantity <= 0
    or p_expected_source_quantity <> trunc(p_expected_source_quantity, 3) then
    raise exception 'Mengen duerfen hoechstens drei Nachkommastellen haben';
  end if;
  if p_open_quantity <= 0
    or p_open_quantity <> trunc(p_open_quantity, 3)
    or p_open_quantity > p_expected_source_quantity then
    raise exception 'Die Öffnungsmenge muss groesser als 0 und hoechstens die Ausgangsmenge sein';
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
$function$;

REVOKE ALL ON FUNCTION "public"."merge_undo_fridge_item_open"(uuid, uuid, uuid, timestamp WITH time zone, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."merge_undo_fridge_item_open"(uuid, uuid, uuid, timestamp WITH time zone, text) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."split_fridge_item_open"(uuid, uuid, uuid, uuid, numeric, numeric, timestamp WITH time zone, date, boolean, timestamp WITH time zone) FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION "public"."split_fridge_item_open"(uuid, uuid, uuid, uuid, numeric, numeric, timestamp WITH time zone, date, boolean, timestamp WITH time zone)
  TO "authenticated", "postgres", "service_role";
