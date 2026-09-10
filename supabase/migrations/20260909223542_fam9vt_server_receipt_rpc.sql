SET local check_function_bodies = off;

REVOKE ALL ON TABLE "public"."fridge_items" FROM "anon";

REVOKE ALL ON TABLE "public"."storage_locations" FROM "anon";

CREATE TABLE "public"."inventory_applied_operations" (
  "operation_id" uuid                     NOT NULL,
  "household_id" uuid                     NOT NULL,
  "actor_id"     uuid                     NOT NULL,
  "request"      jsonb                    NOT NULL,
  "result"       jsonb                    NOT NULL,
  "applied_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_applied_operations_pkey" PRIMARY KEY (operation_id),
  CONSTRAINT "inventory_applied_operations_request_check" CHECK ((jsonb_typeof(request) = 'object'::text)),
  CONSTRAINT "inventory_applied_operations_result_check" CHECK ((jsonb_typeof(result) = 'object'::text))
);

ALTER TABLE "public"."inventory_applied_operations"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_inventory_operation (
  p_operation jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_operation_id uuid;
  v_household_id uuid;
  v_created_at timestamptz;
  v_effective_created_at timestamptz;
  v_type text;
  v_mode text;
  v_key text;
  v_sqlstate text;
  v_allowed text[];
  v_required text[];
  v_required_nullable text[];
  v_numeric text[];
  v_nullable_numeric text[];
  v_uuid text[];
  v_nullable_uuid text[];
  v_text text[];
  v_nullable_text text[];
  v_bool text[];
  v_snapshot jsonb;
  v_snapshot_key text;
  v_snapshot_required text[] := array[
    'household_id', 'product_id', 'name', 'unit', 'package_size',
    'package_size_unit', 'location_id', 'expiry_date', 'opened_at',
    'vacuum_sealed', 'expiry_user_set', 'added_by', 'quantity_before'
  ];
  v_snapshot_allowed text[] := array[
    'household_id', 'product_id', 'name', 'unit', 'package_size',
    'package_size_unit', 'location_id', 'expiry_date', 'opened_at',
    'vacuum_sealed', 'expiry_user_set', 'added_by', 'quantity_before'
  ];
  v_receipt public.inventory_applied_operations%rowtype;
  v_lot public.fridge_items%rowtype;
  v_opened public.fridge_items%rowtype;
  v_original public.transactions%rowtype;
  v_original_other public.transactions%rowtype;
  v_original_request jsonb;
  v_original_result jsonb;
  v_new_quantity numeric;
  v_delta numeric;
  v_reversal_type text;
  v_undo_remainder numeric;
  v_source_remainder numeric;
  v_portion numeric;
  v_added_by uuid;
  v_applied_at timestamptz;
  v_lot_read_ids uuid[] := '{}'::uuid[];
  v_lot_created_ids uuid[] := '{}'::uuid[];
  v_lot_updated_ids uuid[] := '{}'::uuid[];
  v_lot_restored_ids uuid[] := '{}'::uuid[];
  v_lot_tombstoned_ids uuid[] := '{}'::uuid[];
  v_ledger_read_ids uuid[] := '{}'::uuid[];
  v_ledger_created_ids uuid[] := '{}'::uuid[];
  v_ledger_reversed_ids uuid[] := '{}'::uuid[];
  v_lot_ids uuid[] := '{}'::uuid[];
  v_ledger_ids uuid[] := '{}'::uuid[];
  v_footprint jsonb;
  v_lots jsonb;
  v_transactions jsonb;
  v_result jsonb;
begin
  if v_actor_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- The invalid envelope is deliberately returned even when no operation ID
  -- can be recovered. There is no receipt and no retryable server effect.
  if p_operation is null or jsonb_typeof(p_operation) <> 'object' then
    return jsonb_build_object(
      'operation_id', null,
      'contract_version', 1,
      'kind', 'invalid',
      'code', 'PAYLOAD_VALIDATION_FAILED'
    );
  end if;

  v_required := array['contract_version', 'operation_id', 'household_id', 'created_at', 'type'];
  v_required_nullable := '{}'::text[];
  v_numeric := '{}'::text[];
  v_nullable_numeric := '{}'::text[];
  v_uuid := '{}'::text[];
  v_nullable_uuid := '{}'::text[];
  v_text := '{}'::text[];
  v_nullable_text := '{}'::text[];
  v_bool := '{}'::text[];
  v_type := p_operation->>'type';
  v_mode := p_operation->>'mode';

  if v_type is null or v_type not in (
    'insert_inventory', 'open_inventory', 'consume_inventory',
    'waste_inventory', 'move_inventory', 'correct_quantity',
    'undo_inventory_operation', 'reseal_inventory',
    'patch_inventory_metadata'
  ) then
    return jsonb_build_object(
      'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
      'contract_version', 1,
      'kind', 'invalid',
      'code', 'PAYLOAD_VALIDATION_FAILED'
    );
  end if;

  -- Every operation uses the same base envelope. The operation-specific
  -- arrays below make missing, null, and wrongly typed fields distinguishable.
  v_numeric := array['contract_version'];
  v_uuid := array['operation_id', 'household_id'];
  v_text := array['created_at', 'type'];

  if v_type = 'insert_inventory' then
    v_required := v_required || array[
      'item_id', 'in_transaction_id', 'quantity', 'name', 'unit', 'location_id',
      'vacuum_sealed', 'expiry_user_set'
    ];
    v_required_nullable := array[
      'product_id', 'package_size', 'package_size_unit', 'expiry_date', 'opened_at'
    ];
    v_uuid := v_uuid || array['item_id', 'in_transaction_id', 'location_id'];
    v_nullable_uuid := array['product_id'];
    v_numeric := v_numeric || array['quantity'];
    v_nullable_numeric := array['package_size'];
    v_text := v_text || array['name', 'unit'];
    v_nullable_text := array['package_size_unit', 'expiry_date', 'opened_at'];
    v_bool := array['vacuum_sealed', 'expiry_user_set'];
  elsif v_type = 'open_inventory' then
    v_required := v_required || array[
      'source_item_id', 'expected_quantity', 'portion_quantity', 'opened_at',
      'vacuum_sealed', 'expiry_user_set', 'expected_snapshot'
    ];
    v_required_nullable := array['expiry_date'];
    v_uuid := v_uuid || array['source_item_id'];
    v_numeric := v_numeric || array['expected_quantity', 'portion_quantity'];
    v_text := v_text || array['opened_at'];
    v_nullable_text := array['expiry_date'];
    v_bool := array['vacuum_sealed', 'expiry_user_set'];
  elsif v_type = 'consume_inventory' then
    v_required := v_required || array[
      'out_transaction_id', 'source_item_id', 'expected_quantity',
      'consumed_quantity', 'unit', 'location_id', 'mode'
    ];
    v_uuid := v_uuid || array['out_transaction_id', 'source_item_id', 'location_id'];
    v_nullable_uuid := array['product_id', 'recipe_id', 'meal_plan_entry_id'];
    v_numeric := v_numeric || array['expected_quantity', 'consumed_quantity'];
    v_text := v_text || array['unit', 'mode'];
    v_nullable_text := array['recipe_name'];
    if v_mode = 'sealed_partial' then
      v_required := v_required || array[
        'opened_item_id', 'portion_quantity', 'remainder_quantity', 'opened_at',
        'vacuum_sealed', 'expiry_user_set', 'merge_snapshot'
      ];
      v_required_nullable := array['expiry_date'];
      v_uuid := v_uuid || array['opened_item_id'];
      v_numeric := v_numeric || array['portion_quantity', 'remainder_quantity'];
      v_text := v_text || array['opened_at'];
      v_nullable_text := v_nullable_text || array['expiry_date'];
      v_bool := array['vacuum_sealed', 'expiry_user_set'];
    elsif v_mode not in ('sealed_full', 'opened') then
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1,
        'kind', 'invalid',
        'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
  elsif v_type = 'waste_inventory' then
    v_required := v_required || array[
      'waste_transaction_id', 'item_id', 'expected_quantity', 'waste_quantity',
      'reason', 'unit', 'location_id'
    ];
    v_required_nullable := array['product_id'];
    v_uuid := v_uuid || array['waste_transaction_id', 'item_id', 'location_id'];
    v_nullable_uuid := array['product_id'];
    v_numeric := v_numeric || array['expected_quantity', 'waste_quantity'];
    v_text := v_text || array['reason', 'unit'];
  elsif v_type = 'move_inventory' then
    v_required := v_required || array[
      'out_transaction_id', 'in_transaction_id', 'item_id', 'expected_quantity',
      'expected_location_id', 'to_location_id', 'unit', 'location_id'
    ];
    v_required_nullable := array['product_id'];
    v_uuid := v_uuid || array[
      'out_transaction_id', 'in_transaction_id', 'item_id',
      'expected_location_id', 'to_location_id', 'location_id'
    ];
    v_nullable_uuid := array['product_id'];
    v_numeric := v_numeric || array['expected_quantity'];
    v_text := v_text || array['unit'];
  elsif v_type = 'correct_quantity' then
    v_required := v_required || array[
      'transaction_id', 'item_id', 'expected_quantity', 'new_quantity', 'unit', 'location_id'
    ];
    v_required_nullable := array['product_id'];
    v_uuid := v_uuid || array['transaction_id', 'item_id', 'location_id'];
    v_nullable_uuid := array['product_id'];
    v_numeric := v_numeric || array['expected_quantity', 'new_quantity'];
    v_text := v_text || array['unit'];
  elsif v_type = 'undo_inventory_operation' then
    v_required := v_required || array['item_id', 'expected_quantity', 'unit', 'location_id', 'mode'];
    v_required_nullable := array['product_id'];
    v_uuid := v_uuid || array['item_id', 'location_id'];
    v_nullable_uuid := array['product_id'];
    v_numeric := v_numeric || array['expected_quantity'];
    v_text := v_text || array['unit', 'mode'];
    v_nullable_text := array['notes'];
    if v_mode = 'reverse_quantity' then
      v_required := v_required || array['reversal_transaction_id', 'reversal_of'];
      v_uuid := v_uuid || array['reversal_transaction_id', 'reversal_of'];
    elsif v_mode = 'reverse_move' then
      v_required := v_required || array[
        'out_transaction_id', 'in_transaction_id', 'out_reversal_of', 'in_reversal_of',
        'expected_location_id', 'to_location_id'
      ];
      v_uuid := v_uuid || array[
        'out_transaction_id', 'in_transaction_id', 'out_reversal_of', 'in_reversal_of',
        'expected_location_id', 'to_location_id'
      ];
    elsif v_mode = 'merge_undo_open' then
      v_required := v_required || array[
        'in_transaction_id', 'reversal_of', 'source_item_id', 'opened_item_id',
        'expected_source_quantity', 'expected_opened_quantity'
      ];
      v_uuid := v_uuid || array['in_transaction_id', 'reversal_of', 'source_item_id', 'opened_item_id'];
      v_numeric := v_numeric || array['expected_source_quantity', 'expected_opened_quantity'];
    else
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1,
        'kind', 'invalid',
        'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
  elsif v_type = 'reseal_inventory' then
    v_required := v_required || array[
      'item_id', 'expected_quantity', 'expected_snapshot', 'expiry_date',
      'vacuum_sealed', 'expiry_user_set'
    ];
    v_required_nullable := array['expiry_date'];
    v_uuid := v_uuid || array['item_id'];
    v_numeric := v_numeric || array['expected_quantity'];
    v_nullable_text := array['expiry_date'];
    v_bool := array['vacuum_sealed', 'expiry_user_set'];
  elsif v_type = 'patch_inventory_metadata' then
    v_required := v_required || array['item_id', 'expected_updated_at'];
    v_uuid := v_uuid || array['item_id'];
    v_text := v_text || array['expected_updated_at'];
    v_nullable_uuid := array['product_id'];
    v_nullable_numeric := array['package_size'];
    v_nullable_text := array['package_size_unit', 'expiry_date'];
  end if;

  v_allowed := v_required || v_required_nullable || v_numeric || v_nullable_numeric
    || v_uuid || v_nullable_uuid || v_text || v_nullable_text || v_bool
    || array[
      'opened_item_id', 'expected_snapshot', 'merge_snapshot', 'name', 'unit',
      'package_size_unit', 'expiry_date', 'vacuum_sealed', 'expiry_user_set'
    ];
  if exists (
    select 1
    from jsonb_object_keys(p_operation) as object_key(key_name)
    where not (key_name = any(v_allowed))
  ) then
    return jsonb_build_object(
      'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
      'contract_version', 1,
      'kind', 'invalid',
      'code', 'PAYLOAD_VALIDATION_FAILED'
    );
  end if;

  foreach v_key in array v_required loop
    if not (p_operation ? v_key) or p_operation->v_key = 'null'::jsonb then
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1,
        'kind', 'invalid',
        'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
  end loop;
  foreach v_key in array v_required_nullable loop
    if not (p_operation ? v_key) then
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1,
        'kind', 'invalid',
        'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
  end loop;

  if jsonb_typeof(p_operation->'contract_version') <> 'number'
     or (p_operation->>'contract_version')::numeric <> 1 then
    return jsonb_build_object(
      'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
      'contract_version', 1,
      'kind', 'invalid',
      'code', 'PAYLOAD_VALIDATION_FAILED'
    );
  end if;

  foreach v_key in array v_numeric loop
    if jsonb_typeof(p_operation->v_key) <> 'number' then
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1,
        'kind', 'invalid',
        'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
    if (p_operation->>v_key)::numeric < 0
       or (p_operation->>v_key)::numeric > 9999999.9
       or (p_operation->>v_key)::numeric <> trunc((p_operation->>v_key)::numeric, 1) then
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1,
        'kind', 'invalid',
        'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
  end loop;
  foreach v_key in array v_nullable_numeric loop
    if p_operation->v_key <> 'null'::jsonb then
      if jsonb_typeof(p_operation->v_key) <> 'number'
         or (p_operation->>v_key)::numeric < 0
         or (p_operation->>v_key)::numeric > 9999999.9
         or (p_operation->>v_key)::numeric <> trunc((p_operation->>v_key)::numeric, 1) then
        return jsonb_build_object(
          'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
          'contract_version', 1,
          'kind', 'invalid',
          'code', 'PAYLOAD_VALIDATION_FAILED'
        );
      end if;
    end if;
  end loop;
  foreach v_key in array v_uuid loop
    if jsonb_typeof(p_operation->v_key) <> 'string' then
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1,
        'kind', 'invalid',
        'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
    perform (p_operation->>v_key)::uuid;
  end loop;
  foreach v_key in array v_nullable_uuid loop
    if p_operation->v_key <> 'null'::jsonb then
      if jsonb_typeof(p_operation->v_key) <> 'string' then
        return jsonb_build_object(
          'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
          'contract_version', 1,
          'kind', 'invalid',
          'code', 'PAYLOAD_VALIDATION_FAILED'
        );
      end if;
      perform (p_operation->>v_key)::uuid;
    end if;
  end loop;
  foreach v_key in array v_text loop
    if jsonb_typeof(p_operation->v_key) <> 'string' then
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1,
        'kind', 'invalid',
        'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
  end loop;
  foreach v_key in array v_nullable_text loop
    if p_operation->v_key <> 'null'::jsonb and jsonb_typeof(p_operation->v_key) <> 'string' then
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1,
        'kind', 'invalid',
        'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
  end loop;
  foreach v_key in array v_bool loop
    if jsonb_typeof(p_operation->v_key) <> 'boolean' then
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1,
        'kind', 'invalid',
        'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
  end loop;

  -- Optional fields keep the strict-object semantics of the TypeScript
  -- contract: omission is different from an explicit null, and nullable
  -- fields are the only fields allowed to carry null.
  if v_type = 'open_inventory' and p_operation ? 'opened_item_id' then
    if jsonb_typeof(p_operation->'opened_item_id') <> 'string' then
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1, 'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
    perform (p_operation->>'opened_item_id')::uuid;
  end if;
  if v_type = 'patch_inventory_metadata' then
    if (p_operation ? 'name' and jsonb_typeof(p_operation->'name') <> 'string')
       or (p_operation ? 'unit' and jsonb_typeof(p_operation->'unit') <> 'string')
       or (p_operation ? 'vacuum_sealed' and jsonb_typeof(p_operation->'vacuum_sealed') <> 'boolean')
       or (p_operation ? 'expiry_user_set' and jsonb_typeof(p_operation->'expiry_user_set') <> 'boolean') then
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1, 'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
  end if;

  if v_type = 'insert_inventory' and (p_operation->>'name') is not null
     and (length(trim(p_operation->>'name')) = 0 or length(p_operation->>'name') > 200) then
    return jsonb_build_object(
      'operation_id', p_operation->'operation_id', 'contract_version', 1,
      'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
    );
  end if;
  if v_type in ('insert_inventory', 'consume_inventory', 'waste_inventory', 'move_inventory', 'correct_quantity', 'undo_inventory_operation')
     and length(trim(p_operation->>'unit')) = 0 then
    return jsonb_build_object(
      'operation_id', p_operation->'operation_id', 'contract_version', 1,
      'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
    );
  end if;
  if v_type = 'waste_inventory' and (p_operation->>'reason') not in ('expired', 'spoiled', 'other') then
    return jsonb_build_object(
      'operation_id', p_operation->'operation_id', 'contract_version', 1,
      'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
    );
  end if;
  if v_type = 'patch_inventory_metadata' then
    if p_operation ? 'name' and p_operation->'name' <> 'null'::jsonb
       and (length(trim(p_operation->>'name')) = 0 or length(p_operation->>'name') > 200) then
      return jsonb_build_object(
        'operation_id', p_operation->'operation_id', 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
    if p_operation ? 'unit' and p_operation->'unit' <> 'null'::jsonb
       and length(trim(p_operation->>'unit')) = 0 then
      return jsonb_build_object(
        'operation_id', p_operation->'operation_id', 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
    if not exists (
      select 1 from jsonb_object_keys(p_operation) as object_key(key_name)
      where key_name in ('product_id', 'name', 'unit', 'package_size', 'package_size_unit',
                         'expiry_date', 'vacuum_sealed', 'expiry_user_set')
    ) then
      return jsonb_build_object(
        'operation_id', p_operation->'operation_id', 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
    if (p_operation ? 'package_size') <> (p_operation ? 'package_size_unit') then
      return jsonb_build_object(
        'operation_id', p_operation->'operation_id', 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
    if (p_operation ? 'package_size') and
       ((p_operation->'package_size' = 'null'::jsonb) <> (p_operation->'package_size_unit' = 'null'::jsonb)) then
      return jsonb_build_object(
        'operation_id', p_operation->'operation_id', 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
  elsif v_type = 'insert_inventory' and
        ((p_operation->'package_size' = 'null'::jsonb) <> (p_operation->'package_size_unit' = 'null'::jsonb)) then
    return jsonb_build_object(
      'operation_id', p_operation->'operation_id', 'contract_version', 1,
      'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
    );
  end if;

  -- Snapshot fields are a strict nested object, not a free-form metadata bag.
  if v_type = 'open_inventory' then
    v_snapshot := p_operation->'expected_snapshot';
  elsif v_type = 'reseal_inventory' then
    v_snapshot := p_operation->'expected_snapshot';
  elsif v_type = 'consume_inventory' and v_mode = 'sealed_partial' then
    v_snapshot := p_operation->'merge_snapshot';
  end if;
  if v_snapshot is not null then
    if jsonb_typeof(v_snapshot) <> 'object'
       or exists (
         select 1
         from jsonb_object_keys(v_snapshot) as object_key(key_name)
         where not (key_name = any(v_snapshot_allowed))
       ) then
      return jsonb_build_object(
        'operation_id', p_operation->'operation_id', 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
    foreach v_snapshot_key in array v_snapshot_required loop
      if not (v_snapshot ? v_snapshot_key) then
        return jsonb_build_object(
          'operation_id', p_operation->'operation_id', 'contract_version', 1,
          'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
        );
      end if;
    end loop;
    if ((v_snapshot->'package_size' = 'null'::jsonb) <> (v_snapshot->'package_size_unit' = 'null'::jsonb)) then
      return jsonb_build_object(
        'operation_id', p_operation->'operation_id', 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
    if jsonb_typeof(v_snapshot->'household_id') <> 'string'
       or jsonb_typeof(v_snapshot->'location_id') <> 'string'
       or jsonb_typeof(v_snapshot->'name') <> 'string'
       or jsonb_typeof(v_snapshot->'unit') <> 'string'
       or jsonb_typeof(v_snapshot->'vacuum_sealed') <> 'boolean'
       or jsonb_typeof(v_snapshot->'expiry_user_set') <> 'boolean'
       or (v_snapshot->'product_id' <> 'null'::jsonb and jsonb_typeof(v_snapshot->'product_id') <> 'string')
       or (v_snapshot->'package_size' <> 'null'::jsonb and jsonb_typeof(v_snapshot->'package_size') <> 'number')
       or (v_snapshot->'package_size_unit' <> 'null'::jsonb and jsonb_typeof(v_snapshot->'package_size_unit') <> 'string')
       or (v_snapshot->'expiry_date' <> 'null'::jsonb and jsonb_typeof(v_snapshot->'expiry_date') <> 'string')
       or (v_snapshot->'opened_at' <> 'null'::jsonb and jsonb_typeof(v_snapshot->'opened_at') <> 'string')
       or (v_snapshot->'added_by' <> 'null'::jsonb and jsonb_typeof(v_snapshot->'added_by') <> 'string') then
      return jsonb_build_object(
        'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
        'contract_version', 1, 'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
    perform (v_snapshot->>'household_id')::uuid;
    perform (v_snapshot->>'location_id')::uuid;
    if v_snapshot->'product_id' <> 'null'::jsonb then perform (v_snapshot->>'product_id')::uuid; end if;
    if v_snapshot->'added_by' <> 'null'::jsonb then perform (v_snapshot->>'added_by')::uuid; end if;
    if jsonb_typeof(v_snapshot->'quantity_before') <> 'number'
       or (v_snapshot->>'quantity_before')::numeric < 0
       or (v_snapshot->>'quantity_before')::numeric > 9999999.9
       or (v_snapshot->>'quantity_before')::numeric <> trunc((v_snapshot->>'quantity_before')::numeric, 1) then
      return jsonb_build_object(
        'operation_id', p_operation->'operation_id', 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
  end if;

  v_operation_id := (p_operation->>'operation_id')::uuid;
  v_household_id := (p_operation->>'household_id')::uuid;
  v_created_at := (p_operation->>'created_at')::timestamptz;
  v_effective_created_at := case
    when v_created_at > now() + interval '5 minutes' then now()
    else v_created_at
  end;

  if not coalesce((select private.is_household_member(v_household_id)), false) then
    raise exception 'not a household member' using errcode = '42501';
  end if;

  -- A transaction-scoped lock serializes all retries for one operation ID
  -- before any inventory row is read or changed. Different operations can
  -- still proceed concurrently and lock their own rows in stable ID order.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_operation_id::text, 0)
  );
  select * into v_receipt
  from public.inventory_applied_operations
  where operation_id = v_operation_id
  for update;
  if found then
    if v_receipt.actor_id <> v_actor_id
       or v_receipt.household_id <> v_household_id then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'ID_PAYLOAD_MISMATCH'
      );
    end if;
    if v_receipt.request <> p_operation then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'ID_PAYLOAD_MISMATCH'
      );
    end if;
    return jsonb_build_object(
      'operation_id', v_operation_id,
      'contract_version', 1,
      'kind', 'replayed',
      'request', v_receipt.request,
      'actor_id', v_receipt.actor_id,
      'applied_at', v_receipt.applied_at,
      'result', v_receipt.result
    );
  end if;

  -- The operation-specific branches below lock their complete lot footprint
  -- before checking the CAS. Every write and the receipt insert then commit
  -- or roll back together.
  if v_type = 'insert_inventory' then
    if (p_operation->>'item_id')::uuid = (p_operation->>'in_transaction_id')::uuid
       or exists (
         select 1 from public.fridge_items
         where id = (p_operation->>'item_id')::uuid
       )
       or exists (
         select 1 from public.transactions
         where id = (p_operation->>'in_transaction_id')::uuid
       ) then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE'
      );
    end if;
    if not exists (
      select 1 from public.storage_locations
      where id = (p_operation->>'location_id')::uuid
        and household_id = v_household_id
        and deleted_at is null
    ) then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE'
      );
    end if;
    insert into public.fridge_items (
      id, household_id, location_id, product_id, name, quantity, unit,
      expiry_date, added_by, created_at, updated_at, deleted_at,
      package_size, package_size_unit, opened_at, vacuum_sealed, expiry_user_set
    ) values (
      (p_operation->>'item_id')::uuid, v_household_id,
      (p_operation->>'location_id')::uuid,
      case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end,
      p_operation->>'name', p_operation->>'quantity', p_operation->>'unit',
      case when p_operation->'expiry_date' = 'null'::jsonb then null else (p_operation->>'expiry_date')::date end,
      v_actor_id, v_effective_created_at, v_effective_created_at, null,
      case when p_operation->'package_size' = 'null'::jsonb then null else (p_operation->>'package_size')::numeric end,
      case when p_operation->'package_size_unit' = 'null'::jsonb then null else p_operation->>'package_size_unit' end,
      case when p_operation->'opened_at' = 'null'::jsonb then null else (p_operation->>'opened_at')::timestamptz end,
      (p_operation->>'vacuum_sealed')::boolean,
      (p_operation->>'expiry_user_set')::boolean
    );
    insert into public.transactions (
      id, operation_id, household_id, fridge_item_id, product_id, actor,
      type, quantity, unit, location_id, created_at
    ) values (
      (p_operation->>'in_transaction_id')::uuid, v_operation_id, v_household_id,
      (p_operation->>'item_id')::uuid,
      case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end,
      v_actor_id, 'in', (p_operation->>'quantity')::numeric, p_operation->>'unit',
      (p_operation->>'location_id')::uuid, v_effective_created_at
    );
    v_lot_created_ids := array[(p_operation->>'item_id')::uuid];
    v_ledger_created_ids := array[(p_operation->>'in_transaction_id')::uuid];
    v_lot_ids := v_lot_created_ids;
    v_ledger_ids := v_ledger_created_ids;
  elsif v_type = 'open_inventory' then
    perform 1 from public.fridge_items
    where id = (p_operation->>'source_item_id')::uuid
      and household_id = v_household_id
    for update;
    select * into v_lot from public.fridge_items
    where id = (p_operation->>'source_item_id')::uuid
      and household_id = v_household_id;
    if not found or v_lot.deleted_at is not null or v_lot.opened_at is not null
       or v_lot.quantity <> (p_operation->>'expected_quantity')::numeric then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE'
      );
    end if;
    if jsonb_build_object(
         'household_id', v_lot.household_id, 'product_id', v_lot.product_id,
         'name', v_lot.name, 'unit', v_lot.unit, 'package_size', v_lot.package_size,
         'package_size_unit', v_lot.package_size_unit, 'location_id', v_lot.location_id,
         'expiry_date', v_lot.expiry_date, 'opened_at', v_lot.opened_at,
         'vacuum_sealed', v_lot.vacuum_sealed, 'expiry_user_set', v_lot.expiry_user_set,
         'added_by', v_lot.added_by, 'quantity_before', v_lot.quantity
       ) <> p_operation->'expected_snapshot' then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE'
      );
    end if;
    v_portion := (p_operation->>'portion_quantity')::numeric;
    if v_portion <= 0 or v_portion > v_lot.quantity
       or (v_lot.package_size is null and v_portion <> v_lot.quantity)
       or (v_lot.package_size is not null and v_portion <> v_lot.package_size) then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE'
      );
    end if;
    v_lot_read_ids := array[v_lot.id];
    v_lot_updated_ids := array[v_lot.id];
    if p_operation ? 'opened_item_id' then
      if (p_operation->>'opened_item_id')::uuid = v_lot.id
         or exists (
           select 1 from public.fridge_items
           where id = (p_operation->>'opened_item_id')::uuid
         ) then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'STALE_BASE'
        );
      end if;
      v_new_quantity := v_lot.quantity - v_portion;
      update public.fridge_items
      set quantity = v_new_quantity,
          deleted_at = case when v_new_quantity = 0 then v_effective_created_at else null end
      where id = v_lot.id;
      insert into public.fridge_items (
        id, household_id, location_id, product_id, name, quantity, unit,
        expiry_date, added_by, created_at, updated_at, deleted_at,
        package_size, package_size_unit, opened_at, vacuum_sealed, expiry_user_set
      ) values (
        (p_operation->>'opened_item_id')::uuid, v_lot.household_id, v_lot.location_id,
        v_lot.product_id, v_lot.name, v_portion, v_lot.unit,
        case when p_operation->'expiry_date' = 'null'::jsonb then null else (p_operation->>'expiry_date')::date end,
        coalesce(v_lot.added_by, v_actor_id), v_effective_created_at, v_effective_created_at, null,
        v_lot.package_size, v_lot.package_size_unit, (p_operation->>'opened_at')::timestamptz,
        (p_operation->>'vacuum_sealed')::boolean, (p_operation->>'expiry_user_set')::boolean
      );
      v_lot_created_ids := array[(p_operation->>'opened_item_id')::uuid];
      if v_new_quantity = 0 then
        v_lot_tombstoned_ids := array[v_lot.id];
      end if;
      v_lot_ids := array[v_lot.id, (p_operation->>'opened_item_id')::uuid];
    else
      update public.fridge_items
      set opened_at = (p_operation->>'opened_at')::timestamptz,
          expiry_date = case when p_operation->'expiry_date' = 'null'::jsonb then null else (p_operation->>'expiry_date')::date end,
          vacuum_sealed = (p_operation->>'vacuum_sealed')::boolean,
          expiry_user_set = (p_operation->>'expiry_user_set')::boolean
      where id = v_lot.id;
      v_lot_ids := array[v_lot.id];
    end if;
  elsif v_type = 'consume_inventory' or v_type = 'waste_inventory' then
    v_key := case when v_type = 'consume_inventory' then 'source_item_id' else 'item_id' end;
    perform 1 from public.fridge_items
    where id = (p_operation->>v_key)::uuid and household_id = v_household_id
    for update;
    select * into v_lot from public.fridge_items
    where id = (p_operation->>v_key)::uuid and household_id = v_household_id;
    if not found or v_lot.deleted_at is not null
       or v_lot.quantity <> (p_operation->>'expected_quantity')::numeric
       or v_lot.product_id is distinct from case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end
       or v_lot.unit <> p_operation->>'unit'
       or v_lot.location_id <> (p_operation->>'location_id')::uuid then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE'
      );
    end if;
    v_portion := case when v_type = 'consume_inventory' then (p_operation->>'consumed_quantity')::numeric else (p_operation->>'waste_quantity')::numeric end;
    if v_portion <= 0 or v_portion > v_lot.quantity then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'INSUFFICIENT_QUANTITY'
      );
    end if;
    v_lot_read_ids := array[v_lot.id];
    v_lot_updated_ids := array[v_lot.id];
    if v_type = 'consume_inventory' and v_mode = 'sealed_partial' then
      if v_lot.opened_at is not null
         or (p_operation->>'opened_item_id')::uuid = v_lot.id
         or (p_operation->>'portion_quantity')::numeric <> coalesce(v_lot.package_size, 0)
         or (p_operation->>'portion_quantity')::numeric > v_lot.quantity
         or (p_operation->>'consumed_quantity')::numeric > (p_operation->>'portion_quantity')::numeric
         or (p_operation->>'remainder_quantity')::numeric <>
            ((p_operation->>'portion_quantity')::numeric - (p_operation->>'consumed_quantity')::numeric)
         or (p_operation->>'remainder_quantity')::numeric <= 0
         or jsonb_build_object(
              'household_id', v_lot.household_id, 'product_id', v_lot.product_id,
              'name', v_lot.name, 'unit', v_lot.unit, 'package_size', v_lot.package_size,
              'package_size_unit', v_lot.package_size_unit, 'location_id', v_lot.location_id,
              'expiry_date', v_lot.expiry_date, 'opened_at', v_lot.opened_at,
              'vacuum_sealed', v_lot.vacuum_sealed, 'expiry_user_set', v_lot.expiry_user_set,
              'added_by', v_lot.added_by, 'quantity_before', v_lot.quantity
            ) <> p_operation->'merge_snapshot'
         or exists (select 1 from public.fridge_items where id = (p_operation->>'opened_item_id')::uuid) then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'STALE_BASE'
        );
      end if;
      v_new_quantity := v_lot.quantity - (p_operation->>'portion_quantity')::numeric;
      update public.fridge_items
      set quantity = v_new_quantity,
          deleted_at = case when v_new_quantity = 0 then v_effective_created_at else null end
      where id = v_lot.id;
      insert into public.fridge_items (
        id, household_id, location_id, product_id, name, quantity, unit,
        expiry_date, added_by, created_at, updated_at, deleted_at,
        package_size, package_size_unit, opened_at, vacuum_sealed, expiry_user_set
      ) values (
        (p_operation->>'opened_item_id')::uuid, v_lot.household_id, v_lot.location_id,
        v_lot.product_id, v_lot.name, (p_operation->>'remainder_quantity')::numeric, v_lot.unit,
        case when p_operation->'expiry_date' = 'null'::jsonb then null else (p_operation->>'expiry_date')::date end,
        coalesce((p_operation->'merge_snapshot'->>'added_by')::uuid, v_actor_id),
        v_effective_created_at, v_effective_created_at, null,
        v_lot.package_size, v_lot.package_size_unit, (p_operation->>'opened_at')::timestamptz,
        (p_operation->>'vacuum_sealed')::boolean, (p_operation->>'expiry_user_set')::boolean
      );
      v_lot_created_ids := array[(p_operation->>'opened_item_id')::uuid];
      if v_new_quantity = 0 then v_lot_tombstoned_ids := array[v_lot.id]; end if;
      v_lot_ids := array[v_lot.id, (p_operation->>'opened_item_id')::uuid];
    else
      if (v_type = 'consume_inventory' and v_mode = 'opened' and v_lot.opened_at is null)
         or (v_type = 'consume_inventory' and v_mode = 'sealed_full' and v_lot.opened_at is not null) then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'STALE_BASE'
        );
      end if;
      v_new_quantity := v_lot.quantity - v_portion;
      update public.fridge_items
      set quantity = v_new_quantity,
          deleted_at = case when v_new_quantity = 0 then v_effective_created_at else null end
      where id = v_lot.id;
      if v_new_quantity = 0 then v_lot_tombstoned_ids := array[v_lot.id]; end if;
      v_lot_ids := array[v_lot.id];
    end if;
    if v_type = 'consume_inventory' then
      insert into public.transactions (
        id, operation_id, household_id, fridge_item_id, product_id, actor,
        type, quantity, unit, location_id, notes, created_at
      ) values (
        (p_operation->>'out_transaction_id')::uuid, v_operation_id, v_household_id,
        case when v_mode = 'sealed_partial' then (p_operation->>'opened_item_id')::uuid else v_lot.id end,
        case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end,
        v_actor_id, 'out', v_portion, p_operation->>'unit', (p_operation->>'location_id')::uuid,
        null, v_effective_created_at
      );
      v_ledger_created_ids := array[(p_operation->>'out_transaction_id')::uuid];
    else
      insert into public.transactions (
        id, operation_id, household_id, fridge_item_id, product_id, actor,
        type, quantity, unit, location_id, reason, created_at
      ) values (
        (p_operation->>'waste_transaction_id')::uuid, v_operation_id, v_household_id,
        v_lot.id,
        case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end,
        v_actor_id, 'waste', v_portion, p_operation->>'unit', (p_operation->>'location_id')::uuid,
        p_operation->>'reason', v_effective_created_at
      );
      v_ledger_created_ids := array[(p_operation->>'waste_transaction_id')::uuid];
    end if;
    v_ledger_ids := v_ledger_created_ids;
  elsif v_type = 'move_inventory' then
    if (p_operation->>'out_transaction_id')::uuid = (p_operation->>'in_transaction_id')::uuid
       or (p_operation->>'expected_location_id')::uuid = (p_operation->>'to_location_id')::uuid
       or exists (
         select 1 from public.transactions
         where id in (
           (p_operation->>'out_transaction_id')::uuid,
           (p_operation->>'in_transaction_id')::uuid
         )
       ) then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE'
      );
    end if;
    perform 1 from public.fridge_items
    where id = (p_operation->>'item_id')::uuid
      and household_id = v_household_id
    for update;
    select * into v_lot
    from public.fridge_items
    where id = (p_operation->>'item_id')::uuid
      and household_id = v_household_id;
    if not found or v_lot.deleted_at is not null
       or v_lot.quantity <> (p_operation->>'expected_quantity')::numeric
       or v_lot.product_id is distinct from case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end
       or v_lot.unit <> p_operation->>'unit'
       or v_lot.location_id <> (p_operation->>'expected_location_id')::uuid
       or p_operation->>'location_id' <> p_operation->>'expected_location_id'
       or not exists (
         select 1 from public.storage_locations
         where id = (p_operation->>'to_location_id')::uuid
           and household_id = v_household_id
           and deleted_at is null
       ) then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE'
      );
    end if;
    update public.fridge_items
    set location_id = (p_operation->>'to_location_id')::uuid
    where id = v_lot.id;
    insert into public.transactions (
      id, operation_id, household_id, fridge_item_id, product_id, actor,
      type, quantity, unit, location_id, notes, created_at
    ) values (
      (p_operation->>'out_transaction_id')::uuid, v_operation_id, v_household_id,
      v_lot.id, v_lot.product_id, v_actor_id, 'out', v_lot.quantity, v_lot.unit,
      v_lot.location_id, null, v_effective_created_at
    ), (
      (p_operation->>'in_transaction_id')::uuid, v_operation_id, v_household_id,
      v_lot.id, v_lot.product_id, v_actor_id, 'in', v_lot.quantity, v_lot.unit,
      (p_operation->>'to_location_id')::uuid, null, v_effective_created_at
    );
    v_lot_read_ids := array[v_lot.id];
    v_lot_updated_ids := array[v_lot.id];
    v_lot_ids := array[v_lot.id];
    v_ledger_created_ids := array[
      (p_operation->>'out_transaction_id')::uuid,
      (p_operation->>'in_transaction_id')::uuid
    ];
    v_ledger_ids := v_ledger_created_ids;
  elsif v_type = 'correct_quantity' then
    if (p_operation->>'transaction_id')::uuid in (
         (select id from public.transactions where id = (p_operation->>'transaction_id')::uuid)
       ) then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE'
      );
    end if;
    if (p_operation->>'new_quantity')::numeric = (p_operation->>'expected_quantity')::numeric then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
      );
    end if;
    perform 1 from public.fridge_items
    where id = (p_operation->>'item_id')::uuid
      and household_id = v_household_id
    for update;
    select * into v_lot
    from public.fridge_items
    where id = (p_operation->>'item_id')::uuid
      and household_id = v_household_id;
    if not found or v_lot.deleted_at is not null
       or v_lot.quantity <> (p_operation->>'expected_quantity')::numeric
       or v_lot.product_id is distinct from case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end
       or v_lot.unit <> p_operation->>'unit'
       or v_lot.location_id <> (p_operation->>'location_id')::uuid then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE'
      );
    end if;
    v_delta := abs((p_operation->>'new_quantity')::numeric - v_lot.quantity);
    update public.fridge_items
    set quantity = (p_operation->>'new_quantity')::numeric,
        deleted_at = case when (p_operation->>'new_quantity')::numeric = 0 then v_effective_created_at else null end
    where id = v_lot.id;
    insert into public.transactions (
      id, operation_id, household_id, fridge_item_id, product_id, actor,
      type, quantity, unit, location_id, notes, created_at
    ) values (
      (p_operation->>'transaction_id')::uuid, v_operation_id, v_household_id,
      v_lot.id, v_lot.product_id, v_actor_id,
      case when (p_operation->>'new_quantity')::numeric > v_lot.quantity then 'in' else 'out' end,
      v_delta, v_lot.unit, v_lot.location_id, '[Manual correction]', v_effective_created_at
    );
    v_lot_read_ids := array[v_lot.id];
    v_lot_updated_ids := array[v_lot.id];
    v_lot_ids := array[v_lot.id];
    v_ledger_created_ids := array[(p_operation->>'transaction_id')::uuid];
    v_ledger_ids := v_ledger_created_ids;
    if (p_operation->>'new_quantity')::numeric = 0 then
      v_lot_tombstoned_ids := array[v_lot.id];
    end if;
  elsif v_type = 'undo_inventory_operation' then
    if v_mode = 'reverse_move' then
      if (p_operation->>'out_transaction_id')::uuid = (p_operation->>'in_transaction_id')::uuid
         or (p_operation->>'out_reversal_of')::uuid = (p_operation->>'in_reversal_of')::uuid
         or (p_operation->>'out_transaction_id')::uuid in (
           (p_operation->>'out_reversal_of')::uuid, (p_operation->>'in_reversal_of')::uuid
         )
         or (p_operation->>'in_transaction_id')::uuid in (
           (p_operation->>'out_reversal_of')::uuid, (p_operation->>'in_reversal_of')::uuid
         )
         or (p_operation->>'expected_location_id')::uuid = (p_operation->>'to_location_id')::uuid
         or exists (
           select 1 from public.transactions
           where id in (
             (p_operation->>'out_transaction_id')::uuid,
             (p_operation->>'in_transaction_id')::uuid
           )
         ) then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
        );
      end if;
      perform 1 from public.fridge_items
      where id = (p_operation->>'item_id')::uuid
        and household_id = v_household_id
      for update;
      perform 1 from public.transactions
      where id in (
        (p_operation->>'out_reversal_of')::uuid,
        (p_operation->>'in_reversal_of')::uuid
      )
      order by id
      for update;
      select * into v_original
      from public.transactions
      where id = (p_operation->>'in_reversal_of')::uuid
        and household_id = v_household_id;
      select * into v_original_other
      from public.transactions
      where id = (p_operation->>'out_reversal_of')::uuid
        and household_id = v_household_id;
      select * into v_lot
      from public.fridge_items
      where id = (p_operation->>'item_id')::uuid
        and household_id = v_household_id;
      if not found or v_original.id is null or v_original_other.id is null then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'STALE_BASE'
        );
      end if;
      if v_original.reversal_of is not null or v_original_other.reversal_of is not null then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'DEPENDENT_MUTATION_EXISTS'
        );
      end if;
      select r.request into v_original_request
      from public.inventory_applied_operations r
      where r.operation_id = v_original.operation_id
        and r.household_id = v_household_id;
      if v_original_request is null then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'STALE_BASE'
        );
      end if;
      if v_created_at < (v_original_request->>'created_at')::timestamptz
         or v_created_at >= (v_original_request->>'created_at')::timestamptz + interval '24 hours' then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'UNDO_WINDOW_EXPIRED'
        );
      end if;
      if v_original.operation_id <> v_original_other.operation_id
         or v_original.type <> 'out'
         or v_original_other.type <> 'in'
         or v_original.household_id <> v_household_id
         or v_original_other.household_id <> v_household_id
         or v_original.fridge_item_id <> (p_operation->>'item_id')::uuid
         or v_original_other.fridge_item_id <> (p_operation->>'item_id')::uuid
         or v_original.location_id <> (p_operation->>'expected_location_id')::uuid
         or v_original_other.location_id <> (p_operation->>'to_location_id')::uuid
         or v_lot.location_id <> (p_operation->>'to_location_id')::uuid
         or v_lot.quantity <> (p_operation->>'expected_quantity')::numeric
         or v_lot.deleted_at is not null
         or v_original.quantity <> v_original_other.quantity
         or v_original.quantity <> (p_operation->>'expected_quantity')::numeric
         or v_original.product_id is distinct from case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end
         or v_original_other.product_id is distinct from v_original.product_id
         or v_original.unit <> p_operation->>'unit'
         or v_original_other.unit <> p_operation->>'unit'
         or p_operation->>'location_id' <> p_operation->>'expected_location_id'
         or v_original_request->>'type' <> 'move_inventory'
         or v_original_request->>'operation_id' <> v_original.operation_id::text
         or v_original_request->>'out_transaction_id' <> v_original.id::text
         or v_original_request->>'in_transaction_id' <> v_original_other.id::text
         or v_original_request->>'item_id' <> (p_operation->>'item_id')
         or (v_original_request->>'expected_quantity')::numeric <> (p_operation->>'expected_quantity')::numeric
         or (v_original_request->>'expected_location_id')::uuid <> (p_operation->>'expected_location_id')::uuid
         or (v_original_request->>'to_location_id')::uuid <> (p_operation->>'to_location_id')::uuid
         or (v_original_request->>'product_id') is distinct from p_operation->>'product_id'
         or v_original_request->>'unit' <> p_operation->>'unit'
         or v_original_request->>'location_id' <> p_operation->>'expected_location_id' then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'STALE_BASE'
        );
      end if;
      if exists (
        select 1 from public.transactions t
        where t.household_id = v_household_id
          and t.fridge_item_id = v_lot.id
          and t.id not in (v_original.id, v_original_other.id)
          and t.created_at >= (v_original_request->>'created_at')::timestamptz
      ) or exists (
        select 1 from public.inventory_applied_operations r
        where r.household_id = v_household_id
          and r.operation_id <> v_original.operation_id
          and (r.request->>'created_at')::timestamptz >= (v_original_request->>'created_at')::timestamptz
          and (
            r.request->>'item_id' = v_lot.id::text
            or r.request->>'source_item_id' = v_lot.id::text
            or r.request->>'opened_item_id' = v_lot.id::text
          )
      ) then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'DEPENDENT_MUTATION_EXISTS'
        );
      end if;
      insert into public.transactions (
        id, operation_id, household_id, fridge_item_id, product_id, actor,
        type, quantity, unit, location_id, notes, reversal_of, created_at
      ) values (
        (p_operation->>'in_transaction_id')::uuid, v_operation_id, v_household_id,
        v_lot.id, v_lot.product_id, v_actor_id, 'in', v_original.quantity,
        v_lot.unit, (p_operation->>'expected_location_id')::uuid,
        case when p_operation->'notes' = 'null'::jsonb then null else p_operation->>'notes' end,
        v_original.id, v_effective_created_at
      ), (
        (p_operation->>'out_transaction_id')::uuid, v_operation_id, v_household_id,
        v_lot.id, v_lot.product_id, v_actor_id, 'out', v_original_other.quantity,
        v_lot.unit, (p_operation->>'to_location_id')::uuid,
        case when p_operation->'notes' = 'null'::jsonb then null else p_operation->>'notes' end,
        v_original_other.id, v_effective_created_at
      );
      update public.fridge_items
      set location_id = (p_operation->>'expected_location_id')::uuid
      where id = v_lot.id;
      v_lot_read_ids := array[v_lot.id];
      v_lot_updated_ids := array[v_lot.id];
      v_lot_ids := array[v_lot.id];
      v_ledger_read_ids := array[v_original.id, v_original_other.id];
      v_ledger_reversed_ids := v_ledger_read_ids;
      v_ledger_created_ids := array[
        (p_operation->>'in_transaction_id')::uuid,
        (p_operation->>'out_transaction_id')::uuid
      ];
      v_ledger_ids := v_ledger_read_ids || v_ledger_created_ids;
    else
      -- reverse_quantity and merge_undo_open both identify their source
      -- through the original OUT/IN ledger ID. The merge mode additionally
      -- locks and validates the opened remainder before writing anything.
      if v_mode = 'merge_undo_open' then
        perform 1 from public.fridge_items
        where id in (
          (p_operation->>'source_item_id')::uuid,
          (p_operation->>'opened_item_id')::uuid
        )
        and household_id = v_household_id
        order by id
        for update;
      else
        perform 1 from public.fridge_items
        where id = (p_operation->>'item_id')::uuid
          and household_id = v_household_id
        for update;
      end if;
      perform 1 from public.transactions
      where id = (p_operation->>'reversal_of')::uuid
      order by id
      for update;
      select * into v_original
      from public.transactions
      where id = (p_operation->>'reversal_of')::uuid
        and household_id = v_household_id;
      if not found then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'STALE_BASE'
        );
      end if;
      if v_original.reversal_of is not null then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'DEPENDENT_MUTATION_EXISTS'
        );
      end if;
      select r.request into v_original_request
      from public.inventory_applied_operations r
      where r.operation_id = v_original.operation_id
        and r.household_id = v_household_id;
      if v_original_request is null then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'STALE_BASE'
        );
      end if;
      if v_created_at < (v_original_request->>'created_at')::timestamptz
         or v_created_at >= (v_original_request->>'created_at')::timestamptz + interval '24 hours' then
        return jsonb_build_object(
          'operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'conflict', 'code', 'UNDO_WINDOW_EXPIRED'
        );
      end if;
      if v_mode = 'merge_undo_open' then
        if (p_operation->>'in_transaction_id')::uuid in (
             select id from public.transactions
             where id = (p_operation->>'in_transaction_id')::uuid
           ) then
          return jsonb_build_object(
            'operation_id', v_operation_id, 'contract_version', 1,
            'kind', 'conflict', 'code', 'STALE_BASE'
          );
        end if;
        select * into v_lot
        from public.fridge_items
        where id = (p_operation->>'source_item_id')::uuid
          and household_id = v_household_id;
        select * into v_opened
        from public.fridge_items
        where id = (p_operation->>'opened_item_id')::uuid
          and household_id = v_household_id;
        if v_lot.id is null or v_opened.id is null then
          return jsonb_build_object(
            'operation_id', v_operation_id, 'contract_version', 1,
            'kind', 'conflict', 'code', 'STALE_BASE'
          );
        end if;
        if v_original.type <> 'out'
           or v_original.fridge_item_id <> (p_operation->>'opened_item_id')::uuid
           or v_original.household_id <> v_household_id
           or v_original.location_id <> (p_operation->>'location_id')::uuid
           or v_original.product_id is distinct from case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end
           or v_original.unit <> p_operation->>'unit'
           or v_original.quantity <> (v_original_request->>'consumed_quantity')::numeric
           or v_original_request->>'type' <> 'consume_inventory'
           or v_original_request->>'mode' <> 'sealed_partial'
           or v_original_request->>'operation_id' <> v_original.operation_id::text
           or v_original_request->>'out_transaction_id' <> v_original.id::text
           or v_original_request->>'household_id' <> v_household_id::text
           or v_original_request->>'source_item_id' <> (p_operation->>'source_item_id')
           or v_original_request->>'opened_item_id' <> (p_operation->>'opened_item_id')
           or v_original_request->>'product_id' is distinct from p_operation->>'product_id'
           or v_original_request->>'unit' <> p_operation->>'unit'
           or v_original_request->>'location_id' <> p_operation->>'location_id'
           or (v_original_request->>'expected_quantity')::numeric <>
              (v_original_request->'merge_snapshot'->>'quantity_before')::numeric
           or v_original_request->>'remainder_quantity' <> v_opened.quantity::text
           or v_original_request->>'remainder_quantity' <> (p_operation->>'expected_opened_quantity')
           or v_original_request->>'opened_at' is null
           or v_original_request->>'opened_at' <> v_opened.opened_at::text
           or v_original_request->>'expiry_date' is distinct from v_opened.expiry_date::text
           or v_original_request->>'vacuum_sealed' <> v_opened.vacuum_sealed::text
           or v_original_request->>'expiry_user_set' <> v_opened.expiry_user_set::text
           or v_lot.quantity <> (p_operation->>'expected_source_quantity')::numeric
           or v_opened.quantity <> (p_operation->>'expected_opened_quantity')::numeric
           or v_opened.deleted_at is not null
           or v_lot.product_id is distinct from case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end
           or v_lot.unit <> p_operation->>'unit'
           or v_lot.location_id <> (p_operation->>'location_id')::uuid
           or v_opened.product_id is distinct from v_lot.product_id
           or v_opened.unit <> v_lot.unit
           or v_opened.location_id <> v_lot.location_id
           or jsonb_build_object(
                'household_id', v_lot.household_id, 'product_id', v_lot.product_id,
                'name', v_lot.name, 'unit', v_lot.unit, 'package_size', v_lot.package_size,
                'package_size_unit', v_lot.package_size_unit, 'location_id', v_lot.location_id,
                'expiry_date', v_lot.expiry_date, 'opened_at', v_lot.opened_at,
                'vacuum_sealed', v_lot.vacuum_sealed, 'expiry_user_set', v_lot.expiry_user_set,
                'added_by', v_lot.added_by, 'quantity_before',
                (v_original_request->'merge_snapshot'->>'quantity_before')::numeric
              ) <> v_original_request->'merge_snapshot'
           or jsonb_build_object(
                'household_id', v_opened.household_id, 'product_id', v_opened.product_id,
                'name', v_opened.name, 'unit', v_opened.unit, 'package_size', v_opened.package_size,
                'package_size_unit', v_opened.package_size_unit, 'location_id', v_opened.location_id,
                'expiry_date', v_opened.expiry_date, 'opened_at', null,
                'vacuum_sealed', v_lot.vacuum_sealed, 'expiry_user_set', v_lot.expiry_user_set,
                'added_by', v_opened.added_by, 'quantity_before',
                (v_original_request->'merge_snapshot'->>'quantity_before')::numeric
              ) <> v_original_request->'merge_snapshot' then
          return jsonb_build_object(
            'operation_id', v_operation_id, 'contract_version', 1,
            'kind', 'conflict', 'code', 'STALE_BASE'
          );
        end if;
        if exists (
          select 1 from public.transactions t
          where t.household_id = v_household_id
            and t.fridge_item_id in (v_lot.id, v_opened.id)
            and t.id <> v_original.id
            and t.created_at >= (v_original_request->>'created_at')::timestamptz
        ) or exists (
          select 1 from public.inventory_applied_operations r
          where r.household_id = v_household_id
            and r.operation_id <> v_original.operation_id
            and (r.request->>'created_at')::timestamptz >= (v_original_request->>'created_at')::timestamptz
            and (
              r.request->>'item_id' in (v_lot.id::text, v_opened.id::text)
              or r.request->>'source_item_id' in (v_lot.id::text, v_opened.id::text)
              or r.request->>'opened_item_id' in (v_lot.id::text, v_opened.id::text)
            )
        ) then
          return jsonb_build_object(
            'operation_id', v_operation_id, 'contract_version', 1,
            'kind', 'conflict', 'code', 'DEPENDENT_MUTATION_EXISTS'
          );
        end if;
        update public.fridge_items
        set quantity = v_lot.quantity + (v_original_request->>'portion_quantity')::numeric,
            deleted_at = null
        where id = v_lot.id;
        update public.fridge_items
        set quantity = 0,
            deleted_at = v_effective_created_at
        where id = v_opened.id;
        insert into public.transactions (
          id, operation_id, household_id, fridge_item_id, product_id, actor,
          type, quantity, unit, location_id, notes, reversal_of, created_at
        ) values (
          (p_operation->>'in_transaction_id')::uuid, v_operation_id, v_household_id,
          v_lot.id, v_lot.product_id, v_actor_id, 'in', v_original.quantity,
          v_lot.unit, v_lot.location_id,
          case when p_operation->'notes' = 'null'::jsonb then null else p_operation->>'notes' end,
          v_original.id, v_effective_created_at
        );
        v_lot_read_ids := array[v_lot.id, v_opened.id];
        v_lot_updated_ids := array[v_lot.id, v_opened.id];
        if v_lot.deleted_at is not null then v_lot_restored_ids := array[v_lot.id]; end if;
        v_lot_tombstoned_ids := array[v_opened.id];
        v_lot_ids := array[v_lot.id, v_opened.id];
        v_ledger_read_ids := array[v_original.id];
        v_ledger_reversed_ids := array[v_original.id];
        v_ledger_created_ids := array[(p_operation->>'in_transaction_id')::uuid];
        v_ledger_ids := v_ledger_read_ids || v_ledger_created_ids;
      else
        if (p_operation->>'reversal_transaction_id')::uuid in (
             select id from public.transactions
             where id = (p_operation->>'reversal_transaction_id')::uuid
           ) then
          return jsonb_build_object(
            'operation_id', v_operation_id, 'contract_version', 1,
            'kind', 'conflict', 'code', 'STALE_BASE'
          );
        end if;
        select * into v_lot
        from public.fridge_items
        where id = (p_operation->>'item_id')::uuid
          and household_id = v_household_id;
        if v_lot.id is null then
          return jsonb_build_object(
            'operation_id', v_operation_id, 'contract_version', 1,
            'kind', 'conflict', 'code', 'STALE_BASE'
          );
        end if;
        if v_original.type not in ('in', 'out', 'waste')
           or v_original.fridge_item_id <> v_lot.id
           or v_original.household_id <> v_household_id
           or v_original.product_id is distinct from case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end
           or v_original.unit <> p_operation->>'unit'
           or v_original.location_id <> (p_operation->>'location_id')::uuid
           or v_lot.product_id is distinct from case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end
           or v_lot.unit <> p_operation->>'unit'
           or v_lot.location_id <> (p_operation->>'location_id')::uuid
           or v_original_request->>'operation_id' <> v_original.operation_id::text
           or v_original_request->>'household_id' <> v_household_id::text
           or v_original_request->>'product_id' is distinct from p_operation->>'product_id'
           or v_original_request->>'unit' <> p_operation->>'unit'
           or v_original_request->>'location_id' <> p_operation->>'location_id' then
          return jsonb_build_object(
            'operation_id', v_operation_id, 'contract_version', 1,
            'kind', 'conflict', 'code', 'STALE_BASE'
          );
        end if;
        if v_original_request->>'type' = 'insert_inventory' then
          v_undo_remainder := (v_original_request->>'quantity')::numeric;
          if v_original.type <> 'in' or v_original.id::text <> v_original_request->>'in_transaction_id'
             or v_original_request->>'item_id' <> v_lot.id::text then
            v_undo_remainder := null;
          end if;
        elsif v_original_request->>'type' = 'consume_inventory'
              and v_original_request->>'mode' <> 'sealed_partial' then
          v_undo_remainder := (v_original_request->>'expected_quantity')::numeric
            - (v_original_request->>'consumed_quantity')::numeric;
          if v_original.type <> 'out' or v_original.id::text <> v_original_request->>'out_transaction_id'
             or v_original_request->>'source_item_id' <> v_lot.id::text then
            v_undo_remainder := null;
          end if;
        elsif v_original_request->>'type' = 'waste_inventory' then
          v_undo_remainder := (v_original_request->>'expected_quantity')::numeric
            - (v_original_request->>'waste_quantity')::numeric;
          if v_original.type <> 'waste' or v_original.id::text <> v_original_request->>'waste_transaction_id'
             or v_original_request->>'item_id' <> v_lot.id::text then
            v_undo_remainder := null;
          end if;
        elsif v_original_request->>'type' = 'correct_quantity' then
          v_undo_remainder := (v_original_request->>'new_quantity')::numeric;
          if v_original.type not in ('in', 'out') or v_original.id::text <> v_original_request->>'transaction_id'
             or v_original_request->>'item_id' <> v_lot.id::text then
            v_undo_remainder := null;
          end if;
        else
          v_undo_remainder := null;
        end if;
        if v_undo_remainder is null then
          return jsonb_build_object(
            'operation_id', v_operation_id, 'contract_version', 1,
            'kind', 'conflict', 'code', 'STALE_BASE'
          );
        end if;
        if v_lot.quantity <> v_undo_remainder then
          return jsonb_build_object(
            'operation_id', v_operation_id, 'contract_version', 1,
            'kind', 'conflict', 'code', 'DEPENDENT_MUTATION_EXISTS'
          );
        end if;
        if v_lot.quantity <> (p_operation->>'expected_quantity')::numeric then
          return jsonb_build_object(
            'operation_id', v_operation_id, 'contract_version', 1,
            'kind', 'conflict', 'code', 'STALE_BASE'
          );
        end if;
        if exists (
          select 1 from public.transactions t
          where t.household_id = v_household_id
            and t.fridge_item_id = v_lot.id
            and t.id <> v_original.id
            and t.created_at >= (v_original_request->>'created_at')::timestamptz
        ) or exists (
          select 1 from public.inventory_applied_operations r
          where r.household_id = v_household_id
            and r.operation_id <> v_original.operation_id
            and (r.request->>'created_at')::timestamptz >= (v_original_request->>'created_at')::timestamptz
            and (
              r.request->>'item_id' = v_lot.id::text
              or r.request->>'source_item_id' = v_lot.id::text
              or r.request->>'opened_item_id' = v_lot.id::text
            )
        ) then
          return jsonb_build_object(
            'operation_id', v_operation_id, 'contract_version', 1,
            'kind', 'conflict', 'code', 'DEPENDENT_MUTATION_EXISTS'
          );
        end if;
        v_new_quantity := case
          when v_original.type = 'in' then v_lot.quantity - v_original.quantity
          else v_lot.quantity + v_original.quantity
        end;
        update public.fridge_items
        set quantity = v_new_quantity,
            deleted_at = case when v_new_quantity = 0 then v_effective_created_at else null end
        where id = v_lot.id;
        insert into public.transactions (
          id, operation_id, household_id, fridge_item_id, product_id, actor,
          type, quantity, unit, location_id, notes, reversal_of, created_at
        ) values (
          (p_operation->>'reversal_transaction_id')::uuid, v_operation_id, v_household_id,
          v_lot.id, v_lot.product_id, v_actor_id,
          case when v_original.type = 'in' then 'out' else 'in' end,
          v_original.quantity, v_lot.unit, v_lot.location_id,
          case when p_operation->'notes' = 'null'::jsonb then null else p_operation->>'notes' end,
          v_original.id, v_effective_created_at
        );
        v_lot_read_ids := array[v_lot.id];
        v_lot_updated_ids := array[v_lot.id];
        if v_lot.deleted_at is not null and v_new_quantity > 0 then
          v_lot_restored_ids := array[v_lot.id];
        end if;
        if v_new_quantity = 0 then v_lot_tombstoned_ids := array[v_lot.id]; end if;
        v_lot_ids := array[v_lot.id];
        v_ledger_read_ids := array[v_original.id];
        v_ledger_reversed_ids := array[v_original.id];
        v_ledger_created_ids := array[(p_operation->>'reversal_transaction_id')::uuid];
        v_ledger_ids := v_ledger_read_ids || v_ledger_created_ids;
      end if;
    end if;
  end if;
  elsif v_type = 'reseal_inventory' then
    perform 1 from public.fridge_items
    where id = (p_operation->>'item_id')::uuid
      and household_id = v_household_id
    for update;
    select * into v_lot
    from public.fridge_items
    where id = (p_operation->>'item_id')::uuid
      and household_id = v_household_id;
    if not found or v_lot.deleted_at is not null
       or v_lot.opened_at is null
       or v_lot.quantity <> (p_operation->>'expected_quantity')::numeric
       or jsonb_build_object(
            'household_id', v_lot.household_id, 'product_id', v_lot.product_id,
            'name', v_lot.name, 'unit', v_lot.unit, 'package_size', v_lot.package_size,
            'package_size_unit', v_lot.package_size_unit, 'location_id', v_lot.location_id,
            'expiry_date', v_lot.expiry_date, 'opened_at', v_lot.opened_at,
            'vacuum_sealed', v_lot.vacuum_sealed, 'expiry_user_set', v_lot.expiry_user_set,
            'added_by', v_lot.added_by, 'quantity_before', v_lot.quantity
          ) <> p_operation->'expected_snapshot' then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE'
      );
    end if;
    update public.fridge_items
    set opened_at = null,
        expiry_date = case when p_operation->'expiry_date' = 'null'::jsonb then null else (p_operation->>'expiry_date')::date end,
        vacuum_sealed = (p_operation->>'vacuum_sealed')::boolean,
        expiry_user_set = (p_operation->>'expiry_user_set')::boolean
    where id = v_lot.id;
    v_lot_read_ids := array[v_lot.id];
    v_lot_updated_ids := array[v_lot.id];
    v_lot_ids := array[v_lot.id];
  elsif v_type = 'patch_inventory_metadata' then
    perform 1 from public.fridge_items
    where id = (p_operation->>'item_id')::uuid
      and household_id = v_household_id
    for update;
    select * into v_lot
    from public.fridge_items
    where id = (p_operation->>'item_id')::uuid
      and household_id = v_household_id;
    if not found or v_lot.deleted_at is not null
       or v_lot.updated_at <> (p_operation->>'expected_updated_at')::timestamptz then
      return jsonb_build_object(
        'operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE'
      );
    end if;
    update public.fridge_items
    set product_id = case
          when p_operation ? 'product_id'
            then case when p_operation->'product_id' = 'null'::jsonb then null else (p_operation->>'product_id')::uuid end
          else product_id
        end,
        name = case when p_operation ? 'name' then p_operation->>'name' else name end,
        unit = case when p_operation ? 'unit' then p_operation->>'unit' else unit end,
        package_size = case
          when p_operation ? 'package_size'
            then case when p_operation->'package_size' = 'null'::jsonb then null else (p_operation->>'package_size')::numeric end
          else package_size
        end,
        package_size_unit = case
          when p_operation ? 'package_size_unit'
            then case when p_operation->'package_size_unit' = 'null'::jsonb then null else p_operation->>'package_size_unit' end
          else package_size_unit
        end,
        expiry_date = case
          when p_operation ? 'expiry_date'
            then case when p_operation->'expiry_date' = 'null'::jsonb then null else (p_operation->>'expiry_date')::date end
          else expiry_date
        end,
        vacuum_sealed = case when p_operation ? 'vacuum_sealed' then (p_operation->>'vacuum_sealed')::boolean else vacuum_sealed end,
        expiry_user_set = case when p_operation ? 'expiry_user_set' then (p_operation->>'expiry_user_set')::boolean else expiry_user_set end
    where id = v_lot.id;
    v_lot_read_ids := array[v_lot.id];
    v_lot_updated_ids := array[v_lot.id];
    v_lot_ids := array[v_lot.id];
  end if;

  -- Normalise footprint arrays before persisting the receipt. Stable ordering
  -- makes the JSON result deterministic across retries and snapshot reads.
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_lot_read_ids
  from (select distinct id from unnest(v_lot_read_ids) as ids(id)) ordered;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_lot_created_ids
  from (select distinct id from unnest(v_lot_created_ids) as ids(id)) ordered;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_lot_updated_ids
  from (select distinct id from unnest(v_lot_updated_ids) as ids(id)) ordered;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_lot_restored_ids
  from (select distinct id from unnest(v_lot_restored_ids) as ids(id)) ordered;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_lot_tombstoned_ids
  from (select distinct id from unnest(v_lot_tombstoned_ids) as ids(id)) ordered;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_ledger_read_ids
  from (select distinct id from unnest(v_ledger_read_ids) as ids(id)) ordered;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_ledger_created_ids
  from (select distinct id from unnest(v_ledger_created_ids) as ids(id)) ordered;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_ledger_reversed_ids
  from (select distinct id from unnest(v_ledger_reversed_ids) as ids(id)) ordered;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_lot_ids
  from (
    select distinct id
    from unnest(
      v_lot_ids || v_lot_read_ids || v_lot_created_ids || v_lot_updated_ids
      || v_lot_restored_ids || v_lot_tombstoned_ids
    ) as ids(id)
  ) ordered;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_ledger_ids
  from (
    select distinct id
    from unnest(v_ledger_ids || v_ledger_read_ids || v_ledger_created_ids || v_ledger_reversed_ids) as ids(id)
  ) ordered;

  select coalesce(jsonb_agg(to_jsonb(fi) order by fi.id), '[]'::jsonb)
    into v_lots
  from public.fridge_items fi
  where fi.household_id = v_household_id
    and fi.id = any(v_lot_ids);
  select coalesce(jsonb_agg(to_jsonb(tx) order by tx.id), '[]'::jsonb)
    into v_transactions
  from public.transactions tx
  where tx.household_id = v_household_id
    and tx.id = any(v_ledger_ids);

  v_applied_at := clock_timestamp();
  v_footprint := jsonb_build_object(
    'lots', jsonb_build_object(
      'read', to_jsonb(v_lot_read_ids),
      'created', to_jsonb(v_lot_created_ids),
      'updated', to_jsonb(v_lot_updated_ids),
      'restored', to_jsonb(v_lot_restored_ids),
      'tombstoned', to_jsonb(v_lot_tombstoned_ids)
    ),
    'ledger', jsonb_build_object(
      'read', to_jsonb(v_ledger_read_ids),
      'created', to_jsonb(v_ledger_created_ids),
      'reversed', to_jsonb(v_ledger_reversed_ids)
    )
  );
  v_result := jsonb_build_object(
    'actor_id', v_actor_id,
    'applied_at', v_applied_at,
    'footprint', v_footprint,
    'lots', v_lots,
    'transactions', v_transactions
  );
  insert into public.inventory_applied_operations (
    operation_id, household_id, actor_id, request, result, applied_at
  ) values (
    v_operation_id, v_household_id, v_actor_id, p_operation, v_result, v_applied_at
  );
  return jsonb_build_object(
    'operation_id', v_operation_id,
    'contract_version', 1,
    'kind', 'applied',
    'request', p_operation,
    'actor_id', v_actor_id,
    'applied_at', v_applied_at,
    'result', v_result
  );
exception
  when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = '42501' then
      raise;
    end if;
    return jsonb_build_object(
      'operation_id', coalesce(v_operation_id, case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end),
      'contract_version', 1,
      'kind', 'invalid',
      'code', 'PAYLOAD_VALIDATION_FAILED'
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.read_inventory_sync_snapshot (
  p_household_id  uuid,
  p_operation_ids uuid[] DEFAULT '{}'::uuid[],
  p_lot_ids       uuid[] DEFAULT '{}'::uuid[]
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_operation_ids uuid[] := coalesce(p_operation_ids, '{}'::uuid[]);
  v_lot_ids uuid[] := coalesce(p_lot_ids, '{}'::uuid[]);
  v_receipts jsonb;
  v_lots jsonb;
  v_lot_presence jsonb;
  v_transactions jsonb;
  v_absent_lot_ids jsonb;
begin
  if v_actor_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not coalesce((select private.is_household_member(p_household_id)), false) then
    raise exception 'not a household member' using errcode = '42501';
  end if;

  with requested_operations as (
    select distinct operation_id
    from unnest(v_operation_ids) as requested(operation_id)
    where operation_id is not null
  ), requested_receipts as (
    select r.*
    from public.inventory_applied_operations r
    join requested_operations q on q.operation_id = r.operation_id
    where r.household_id = p_household_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'operation_id', q.operation_id,
      'status', case when r.operation_id is null then 'absent' else 'present' end,
      'receipt', case when r.operation_id is null then null else jsonb_build_object(
        'operation_id', r.operation_id,
        'contract_version', 1,
        'kind', 'applied',
        'request', r.request,
        'actor_id', r.actor_id,
        'applied_at', r.applied_at,
        'result', r.result
      ) end
    ) order by q.operation_id
  ), '[]'::jsonb)
  into v_receipts
  from requested_operations q
  left join requested_receipts r on r.operation_id = q.operation_id;

  with requested_receipts as (
    select r.*
    from public.inventory_applied_operations r
    where r.household_id = p_household_id
      and r.operation_id = any(v_operation_ids)
  ), receipt_lots as (
    select distinct lot_id
    from requested_receipts r
    cross join lateral jsonb_array_elements_text(
      coalesce(r.result #> '{footprint,lots,read}', '[]'::jsonb)
      || coalesce(r.result #> '{footprint,lots,created}', '[]'::jsonb)
      || coalesce(r.result #> '{footprint,lots,updated}', '[]'::jsonb)
      || coalesce(r.result #> '{footprint,lots,restored}', '[]'::jsonb)
      || coalesce(r.result #> '{footprint,lots,tombstoned}', '[]'::jsonb)
    ) as lot_values(lot_id)
  ), scope_lots as (
    select distinct lot_id::uuid as lot_id
    from (
      select unnest(v_lot_ids)::text as lot_id
      union all
      select lot_id from receipt_lots
    ) requested_lots
  ), receipt_ledger as (
    select distinct ledger_id
    from requested_receipts r
    cross join lateral jsonb_array_elements_text(
      coalesce(r.result #> '{footprint,ledger,read}', '[]'::jsonb)
      || coalesce(r.result #> '{footprint,ledger,created}', '[]'::jsonb)
      || coalesce(r.result #> '{footprint,ledger,reversed}', '[]'::jsonb)
    ) as ledger_values(ledger_id)
  ), scope_ledger as (
    select distinct t.id
    from public.transactions t
    where t.household_id = p_household_id
      and (
        t.fridge_item_id in (select lot_id from scope_lots)
        or t.id in (select ledger_id::uuid from receipt_ledger)
      )
  )
  select coalesce(jsonb_agg(to_jsonb(fi) order by fi.id), '[]'::jsonb)
  into v_lots
  from public.fridge_items fi
  where fi.household_id = p_household_id
    and fi.id in (select lot_id from scope_lots);

  with requested_lots as (
    select distinct lot_id
    from unnest(v_lot_ids) as requested(lot_id)
    where lot_id is not null
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.lot_id,
      'status', case when fi.id is null then 'absent' else 'present' end,
      'row', to_jsonb(fi)
    ) order by q.lot_id
  ), '[]'::jsonb)
  into v_lot_presence
  from requested_lots q
  left join public.fridge_items fi
    on fi.id = q.lot_id
   and fi.household_id = p_household_id;

  with requested_lots as (
    select distinct lot_id
    from unnest(v_lot_ids) as requested(lot_id)
    where lot_id is not null
  )
  select coalesce(jsonb_agg(q.lot_id order by q.lot_id) filter (where fi.id is null), '[]'::jsonb)
  into v_absent_lot_ids
  from requested_lots q
  left join public.fridge_items fi
    on fi.id = q.lot_id
   and fi.household_id = p_household_id;

  with requested_receipts as (
    select r.*
    from public.inventory_applied_operations r
    where r.household_id = p_household_id
      and r.operation_id = any(v_operation_ids)
  ), receipt_lots as (
    select distinct lot_id
    from requested_receipts r
    cross join lateral jsonb_array_elements_text(
      coalesce(r.result #> '{footprint,lots,read}', '[]'::jsonb)
      || coalesce(r.result #> '{footprint,lots,created}', '[]'::jsonb)
      || coalesce(r.result #> '{footprint,lots,updated}', '[]'::jsonb)
      || coalesce(r.result #> '{footprint,lots,restored}', '[]'::jsonb)
      || coalesce(r.result #> '{footprint,lots,tombstoned}', '[]'::jsonb)
    ) as lot_values(lot_id)
  ), requested_lots as (
    select unnest(v_lot_ids)::text as lot_id
    union
    select lot_id from receipt_lots
  ), receipt_ledger as (
    select distinct ledger_id
    from requested_receipts r
    cross join lateral jsonb_array_elements_text(
      coalesce(r.result #> '{footprint,ledger,read}', '[]'::jsonb)
      || coalesce(r.result #> '{footprint,ledger,created}', '[]'::jsonb)
      || coalesce(r.result #> '{footprint,ledger,reversed}', '[]'::jsonb)
    ) as ledger_values(ledger_id)
  )
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb)
  into v_transactions
  from public.transactions t
  where t.household_id = p_household_id
    and (
      t.fridge_item_id in (select lot_id::uuid from requested_lots)
      or t.id in (select ledger_id::uuid from receipt_ledger)
    );

  return jsonb_build_object(
    'household_id', p_household_id,
    'lots', v_lots,
    'lot_presence', v_lot_presence,
    'absent_lot_ids', v_absent_lot_ids,
    'transactions', v_transactions,
    'ledger', v_transactions,
    'receipts', v_receipts
  );
end;
$function$;

ALTER TABLE "public"."inventory_applied_operations"
  ADD CONSTRAINT "inventory_applied_operations_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

CREATE INDEX inventory_applied_operations_household_idx ON public.inventory_applied_operations USING btree (household_id, applied_at);

CREATE POLICY "inventory_applied_operations_select_member" ON "public"."inventory_applied_operations"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.is_household_member(inventory_applied_operations.household_id) AS is_household_member));

COMMENT ON TABLE "public"."inventory_applied_operations" IS 'Unveraenderlicher Server-Receipt fuer jede Inventory-Operation.';

REVOKE ALL ON FUNCTION "public"."apply_inventory_operation"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."apply_inventory_operation"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."read_inventory_sync_snapshot"(uuid, uuid[], uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."read_inventory_sync_snapshot"(uuid, uuid[], uuid[]) TO "authenticated", "postgres";

REVOKE ALL ON TABLE "public"."fridge_items" FROM "authenticated";

GRANT SELECT ON TABLE "public"."fridge_items" TO "authenticated";

REVOKE ALL ON TABLE "public"."fridge_items" FROM "service_role";

GRANT SELECT ON TABLE "public"."fridge_items" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_applied_operations" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_applied_operations" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_applied_operations" TO "service_role";

REVOKE ALL ON TABLE "public"."storage_locations" FROM "authenticated";

GRANT SELECT ON TABLE "public"."storage_locations" TO "authenticated";

REVOKE ALL ON TABLE "public"."storage_locations" FROM "service_role";

GRANT SELECT ON TABLE "public"."storage_locations" TO "service_role";

REVOKE ALL ON TABLE "public"."transactions" FROM "authenticated";

GRANT SELECT ON TABLE "public"."transactions" TO "authenticated";

REVOKE ALL ON TABLE "public"."transactions" FROM "service_role";

GRANT SELECT ON TABLE "public"."transactions" TO "service_role";
