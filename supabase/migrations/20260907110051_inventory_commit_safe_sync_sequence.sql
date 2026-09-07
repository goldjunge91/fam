SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.assign_transaction_sync_sequence()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(41823017);
  new.sync_sequence := pg_catalog.nextval(
    pg_catalog.pg_get_serial_sequence('public.transactions', 'sync_sequence')
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.adjust_fridge_item_quantity (
  p_operation_id   uuid,
  p_transaction_id uuid,
  p_item_id        uuid,
  p_household_id   uuid,
  p_delta          numeric,
  p_created_at     timestamp with time zone
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE TRIGGER transactions_assign_sync_sequence
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION private.assign_transaction_sync_sequence();

REVOKE ALL ON FUNCTION "private"."assign_transaction_sync_sequence"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."assign_transaction_sync_sequence"() TO "postgres";
