set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.merge_undo_fridge_item_open(p_reversal_transaction_id uuid, p_reversal_of uuid, p_household_id uuid, p_created_at timestamp with time zone, p_notes text)
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
$function$
;

