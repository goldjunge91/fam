SET local check_function_bodies = off;

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
  if p_expected_source_quantity <= 0 or p_open_quantity <= 0 then
    raise exception 'Ausgangs- und Öffnungsmenge muessen positiv sein';
  end if;
  if p_expected_source_quantity <> trunc(p_expected_source_quantity, 3)
    or p_open_quantity <> trunc(p_open_quantity, 3) then
    raise exception 'Mengen duerfen hoechstens drei Nachkommastellen haben';
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
$function$;
