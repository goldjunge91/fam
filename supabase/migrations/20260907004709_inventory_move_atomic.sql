SET local check_function_bodies = off;

ALTER TABLE "public"."transactions"
  ADD COLUMN "operation_id" uuid;

CREATE OR REPLACE FUNCTION public.move_fridge_item (
  p_operation_id         uuid,
  p_item_id              uuid,
  p_household_id         uuid,
  p_expected_location_id uuid,
  p_new_location_id      uuid,
  p_expected_quantity    numeric,
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

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_operation_id_move_type" CHECK (((operation_id IS NULL) OR (type = ANY (ARRAY['in'::text, 'out'::text]))));

CREATE UNIQUE INDEX transactions_operation_type_idx ON public.transactions USING btree (operation_id, TYPE)
  WHERE (operation_id IS NOT NULL);

COMMENT ON COLUMN "public"."transactions"."operation_id" IS 'Gemeinsame Provenienz fuer eine atomare Mehrzeilenmutation, z. B. einen Move.';

REVOKE ALL ON FUNCTION "public"."move_fridge_item"(uuid, uuid, uuid, uuid, uuid, numeric, uuid, uuid, timestamp WITH time zone) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."move_fridge_item"(uuid, uuid, uuid, uuid, uuid, numeric, uuid, uuid, timestamp WITH time zone) TO "authenticated", "postgres", "service_role";
