SET local check_function_bodies = off;

ALTER TABLE "public"."fridge_items"
  DROP CONSTRAINT "fridge_items_package_size_check";

ALTER TABLE "public"."fridge_items"
  DROP CONSTRAINT "fridge_items_quantity_check";

ALTER TABLE "public"."transactions"
  DROP CONSTRAINT "transactions_origin_quantity_check";

ALTER TABLE "public"."transactions"
  DROP CONSTRAINT "transactions_quantity_check";

DROP FUNCTION "public"."adjust_fridge_item_quantity"(uuid, uuid, uuid, uuid, numeric, timestamp WITH time zone);

DROP FUNCTION "public"."correct_fridge_item_quantity"(uuid, uuid, uuid, uuid, numeric, numeric, timestamp WITH time zone);

DROP FUNCTION "public"."move_fridge_item"(uuid, uuid, uuid, uuid, uuid, numeric, uuid, uuid, timestamp WITH time zone);

DROP FUNCTION "public"."reverse_move_fridge_item"(uuid, uuid, uuid, uuid, uuid, uuid, numeric, uuid, uuid, timestamp WITH time zone, text);

DROP FUNCTION "public"."split_fridge_item_open"(uuid, uuid, uuid, uuid, numeric, numeric, timestamp WITH time zone, date, boolean, timestamp WITH time zone);

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "package_size" DROP DEFAULT;

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "package_size" TYPE bigint USING "package_size"::bigint;

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "quantity" DROP DEFAULT;

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "quantity" TYPE bigint USING "quantity"::bigint;

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "quantity" SET DEFAULT 1000;

ALTER TABLE "public"."transactions"
  ALTER COLUMN "origin_quantity" DROP DEFAULT;

ALTER TABLE "public"."transactions"
  ALTER COLUMN "origin_quantity" TYPE bigint USING "origin_quantity"::bigint;

ALTER TABLE "public"."transactions"
  ALTER COLUMN "quantity" DROP DEFAULT;

ALTER TABLE "public"."transactions"
  ALTER COLUMN "quantity" TYPE bigint USING "quantity"::bigint;

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "quantity" SET DEFAULT 1000;

CREATE OR REPLACE FUNCTION public.adjust_fridge_item_quantity (
  p_operation_id   uuid,
  p_transaction_id uuid,
  p_item_id        uuid,
  p_household_id   uuid,
  p_delta          bigint,
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
$function$;

CREATE OR REPLACE FUNCTION public.correct_fridge_item_quantity (
  p_operation_id      uuid,
  p_transaction_id    uuid,
  p_item_id           uuid,
  p_household_id      uuid,
  p_expected_quantity bigint,
  p_new_quantity      bigint,
  p_created_at        timestamp with time zone
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.move_fridge_item (
  p_operation_id         uuid,
  p_item_id              uuid,
  p_household_id         uuid,
  p_expected_location_id uuid,
  p_new_location_id      uuid,
  p_expected_quantity    bigint,
  p_out_transaction_id   uuid,
  p_in_transaction_id    uuid,
  p_created_at           timestamp with time zone
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.reverse_inventory_quantity_transaction (
  p_reversal_transaction_id uuid,
  p_reversal_of             uuid,
  p_item_id                 uuid,
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
$function$;

CREATE OR REPLACE FUNCTION public.reverse_move_fridge_item (
  p_operation_id         uuid,
  p_reversal_of          uuid,
  p_item_id              uuid,
  p_household_id         uuid,
  p_expected_location_id uuid,
  p_new_location_id      uuid,
  p_expected_quantity    bigint,
  p_out_transaction_id   uuid,
  p_in_transaction_id    uuid,
  p_created_at           timestamp with time zone,
  p_notes                text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.split_fridge_item_open (
  p_transaction_id           uuid,
  p_source_item_id           uuid,
  p_opened_item_id           uuid,
  p_household_id             uuid,
  p_expected_source_quantity bigint,
  p_open_quantity            bigint,
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
$function$;

ALTER TABLE "public"."fridge_items"
  ADD CONSTRAINT "fridge_items_package_size_check" CHECK ((package_size > 0));

ALTER TABLE "public"."fridge_items"
  ADD CONSTRAINT "fridge_items_quantity_check" CHECK ((quantity >= 0));

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_origin_quantity_check" CHECK ((origin_quantity > 0));

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_quantity_check" CHECK ((quantity > 0));

REVOKE ALL ON FUNCTION "public"."adjust_fridge_item_quantity"(uuid, uuid, uuid, uuid, bigint, timestamp WITH time zone) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."adjust_fridge_item_quantity"(uuid, uuid, uuid, uuid, bigint, timestamp WITH time zone) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."correct_fridge_item_quantity"(uuid, uuid, uuid, uuid, bigint, bigint, timestamp WITH time zone) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."correct_fridge_item_quantity"(uuid, uuid, uuid, uuid, bigint, bigint, timestamp WITH time zone) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."move_fridge_item"(uuid, uuid, uuid, uuid, uuid, bigint, uuid, uuid, timestamp WITH time zone) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."move_fridge_item"(uuid, uuid, uuid, uuid, uuid, bigint, uuid, uuid, timestamp WITH time zone) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."reverse_move_fridge_item"(uuid, uuid, uuid, uuid, uuid, uuid, bigint, uuid, uuid, timestamp WITH time zone, text) FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION "public"."reverse_move_fridge_item"(uuid, uuid, uuid, uuid, uuid, uuid, bigint, uuid, uuid, timestamp WITH time zone, text)
  TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."split_fridge_item_open"(uuid, uuid, uuid, uuid, bigint, bigint, timestamp WITH time zone, date, boolean, timestamp WITH time zone) FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION "public"."split_fridge_item_open"(uuid, uuid, uuid, uuid, bigint, bigint, timestamp WITH time zone, date, boolean, timestamp WITH time zone)
  TO "authenticated", "postgres", "service_role";
