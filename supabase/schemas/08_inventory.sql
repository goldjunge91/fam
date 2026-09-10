-- Gewuenschter declarativer Phase-1-Zustand fuer den geteilten Bestand.
-- Die fuenf Kernoperationen sind der einzige autoritative Schreibpfad.

create table if not exists public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  kind text not null check (kind in ('fridge', 'freezer', 'pantry', 'custom')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists storage_locations_household_id_idx
  on public.storage_locations (household_id);
create index if not exists storage_locations_household_updated_idx
  on public.storage_locations (household_id, updated_at);

create or replace trigger storage_locations_set_updated_at
  before update on public.storage_locations
  for each row
  execute function private.set_updated_at();

alter table public.storage_locations enable row level security;

create policy storage_locations_all_member on public.storage_locations
  for all to authenticated
  using ((select private.is_household_member(storage_locations.household_id)))
  with check ((select private.is_household_member(storage_locations.household_id)));

create table if not exists public.fridge_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  location_id uuid not null references public.storage_locations (id) on delete restrict,
  product_id uuid references public.products (id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 200),
  quantity numeric(10, 1) not null default 1.0,
  unit text not null default 'piece' check (length(trim(unit)) > 0),
  expiry_date date,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  package_size numeric(10, 1),
  package_size_unit text,
  opened_at timestamptz,
  vacuum_sealed boolean not null default false,
  expiry_user_set boolean not null default false,
  constraint fridge_items_quantity_check
    check (quantity >= 0.0 and quantity <= 9999999.9 and quantity * 10 = trunc(quantity * 10)),
  constraint fridge_items_quantity_lifecycle_check
    check ((deleted_at is null and quantity > 0.0) or (deleted_at is not null and quantity = 0.0)),
  constraint fridge_items_package_pair_check
    check ((package_size is null) = (package_size_unit is null)),
  constraint fridge_items_package_size_check
    check (package_size is null or package_size between 0.1 and 9999999.9),
  constraint fridge_items_package_size_unit_check
    check (package_size_unit is null or length(trim(package_size_unit)) > 0)
);

create index if not exists fridge_items_household_id_idx
  on public.fridge_items (household_id);
create index if not exists fridge_items_household_updated_idx
  on public.fridge_items (household_id, updated_at);
create index if not exists fridge_items_product_id_idx
  on public.fridge_items (product_id);
create index if not exists fridge_items_location_id_idx
  on public.fridge_items (location_id);
create index if not exists fridge_items_added_by_idx
  on public.fridge_items (added_by);
create index if not exists fridge_items_expiry_idx
  on public.fridge_items (household_id, expiry_date)
  where deleted_at is null and expiry_date is not null;

create or replace trigger fridge_items_set_updated_at
  before update on public.fridge_items
  for each row
  execute function private.set_updated_at();

alter table public.fridge_items enable row level security;

create policy fridge_items_all_member on public.fridge_items
  for all to authenticated
  using ((select private.is_household_member(fridge_items.household_id)))
  with check (
    (select private.is_household_member(fridge_items.household_id))
    and exists (
      select 1 from public.storage_locations
      where storage_locations.id = fridge_items.location_id
        and storage_locations.household_id = fridge_items.household_id
    )
  );

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  fridge_item_id uuid not null references public.fridge_items (id) on delete restrict,
  product_id uuid references public.products (id) on delete set null,
  actor uuid references public.profiles (id) on delete set null,
  type text not null check (type in ('in', 'out', 'waste')),
  quantity numeric(10, 1) not null check (quantity >= 0.1 and quantity <= 9999999.9 and quantity * 10 = trunc(quantity * 10)),
  unit text not null default 'piece' check (length(trim(unit)) > 0),
  location_id uuid not null references public.storage_locations (id) on delete restrict,
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  operation_id uuid not null,
  operation_payload_hash text,
  reversal_of uuid references public.transactions (id) on delete restrict,
  constraint transactions_notes_check check (notes is null or length(notes) <= 500),
  constraint transactions_reason_check check (
    (type <> 'waste' and reason is null)
    or (type = 'waste' and reason is not null and reason in ('expired', 'spoiled', 'other'))
  )
);

create index if not exists transactions_fridge_item_id_idx
  on public.transactions (fridge_item_id);
create index if not exists transactions_household_id_idx
  on public.transactions (household_id);
create index if not exists transactions_household_created_idx
  on public.transactions (household_id, created_at);
create unique index if not exists transactions_operation_type_idx
  on public.transactions (operation_id, type);
create unique index if not exists transactions_reversal_of_idx
  on public.transactions (reversal_of)
  where reversal_of is not null;

alter table public.transactions enable row level security;

create policy transactions_select_member on public.transactions
  for select to authenticated
  using ((select private.is_household_member(transactions.household_id)));

-- Inventory-Mutationen laufen ausschliesslich ueber diesen SECURITY-DEFINER-RPC.
-- Idempotenz liegt als Payload-Fingerprint auf den append-only Ledgerzeilen,
-- nicht in einem separaten Receipt- oder Snapshot-Protokoll.
create or replace function public.apply_inventory_operation(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_operation_id uuid;
  v_household_id uuid;
  v_created_at timestamptz;
  v_effective_created_at timestamptz;
  v_type text;
  v_mode text;
  v_key text;
  v_hash text;
  v_existing_hash text;
  v_lot public.fridge_items%rowtype;
  v_opened public.fridge_items%rowtype;
  v_quantity numeric;
  v_new_quantity numeric;
  v_delta numeric;
  v_portion numeric;
  v_remainder numeric;
  v_transaction_type text;
  v_lot_ids uuid[] := '{}'::uuid[];
  v_ledger_ids uuid[] := '{}'::uuid[];
  v_allowed text[];
  v_numeric text[];
  v_required text[];
begin
  if p_operation is null or jsonb_typeof(p_operation) <> 'object' then
    return jsonb_build_object('contract_version', 1, 'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
  end if;

  v_type := p_operation->>'type';
  if v_type not in ('insert_inventory', 'consume_inventory', 'waste_inventory', 'move_inventory', 'correct_quantity') then
    return jsonb_build_object('operation_id', p_operation->'operation_id', 'contract_version', 1,
      'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
  end if;

  v_allowed := array['contract_version', 'type', 'operation_id', 'household_id', 'created_at'];
  if v_type = 'insert_inventory' then
    v_allowed := v_allowed || array['item_id', 'in_transaction_id', 'quantity', 'product_id', 'name', 'unit',
      'package_size', 'package_size_unit', 'location_id', 'expiry_date', 'opened_at', 'vacuum_sealed', 'expiry_user_set'];
    v_required := array['item_id', 'in_transaction_id', 'quantity', 'product_id', 'name', 'unit', 'package_size',
      'package_size_unit', 'location_id', 'expiry_date', 'opened_at', 'vacuum_sealed', 'expiry_user_set'];
    v_numeric := array['quantity'];
  elsif v_type = 'consume_inventory' then
    v_allowed := v_allowed || array['out_transaction_id', 'source_item_id', 'expected_quantity', 'consumed_quantity',
      'product_id', 'unit', 'location_id', 'mode', 'recipe_id', 'recipe_name', 'meal_plan_entry_id',
      'opened_item_id', 'portion_quantity', 'remainder_quantity', 'opened_at', 'expiry_date', 'vacuum_sealed',
      'expiry_user_set', 'merge_snapshot'];
    v_required := array['out_transaction_id', 'source_item_id', 'expected_quantity', 'consumed_quantity',
      'product_id', 'unit', 'location_id', 'mode'];
    v_numeric := array['expected_quantity', 'consumed_quantity'];
  elsif v_type = 'waste_inventory' then
    v_allowed := v_allowed || array['waste_transaction_id', 'item_id', 'expected_quantity', 'waste_quantity',
      'reason', 'product_id', 'unit', 'location_id'];
    v_required := array['waste_transaction_id', 'item_id', 'expected_quantity', 'waste_quantity', 'reason',
      'product_id', 'unit', 'location_id'];
    v_numeric := array['expected_quantity', 'waste_quantity'];
  elsif v_type = 'move_inventory' then
    v_allowed := v_allowed || array['out_transaction_id', 'in_transaction_id', 'item_id', 'expected_quantity',
      'expected_location_id', 'to_location_id', 'product_id', 'unit', 'location_id'];
    v_required := array['out_transaction_id', 'in_transaction_id', 'item_id', 'expected_quantity',
      'expected_location_id', 'to_location_id', 'product_id', 'unit', 'location_id'];
    v_numeric := array['expected_quantity'];
  else
    v_allowed := v_allowed || array['transaction_id', 'item_id', 'expected_quantity', 'new_quantity',
      'product_id', 'unit', 'location_id'];
    v_required := array['transaction_id', 'item_id', 'expected_quantity', 'new_quantity', 'product_id', 'unit',
      'location_id'];
    v_numeric := array['expected_quantity', 'new_quantity'];
  end if;

  for v_key in select jsonb_object_keys(p_operation) loop
    if not v_key = any(v_allowed) then
      return jsonb_build_object('operation_id', p_operation->'operation_id', 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
    end if;
  end loop;
  foreach v_key in array v_required loop
    if not (p_operation ? v_key) then
      return jsonb_build_object('operation_id', p_operation->'operation_id', 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
    end if;
  end loop;

  if jsonb_typeof(p_operation->'contract_version') <> 'number'
     or (p_operation->>'contract_version')::numeric <> 1
     or jsonb_typeof(p_operation->'operation_id') <> 'string'
     or jsonb_typeof(p_operation->'household_id') <> 'string'
     or jsonb_typeof(p_operation->'created_at') <> 'string' then
    return jsonb_build_object('operation_id', p_operation->'operation_id', 'contract_version', 1,
      'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
  end if;

  foreach v_key in array v_numeric loop
    if p_operation->v_key = 'null'::jsonb
       or jsonb_typeof(p_operation->v_key) <> 'number'
       or (p_operation->>v_key)::numeric < 0
       or (p_operation->>v_key)::numeric > 9999999.9
       or (p_operation->>v_key)::numeric * 10 <> trunc((p_operation->>v_key)::numeric * 10) then
      return jsonb_build_object('operation_id', p_operation->'operation_id', 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
    end if;
  end loop;

  if v_type = 'insert_inventory' and p_operation->'package_size' <> 'null'::jsonb then
    if jsonb_typeof(p_operation->'package_size') <> 'number'
       or (p_operation->>'package_size')::numeric <= 0
       or (p_operation->>'package_size')::numeric > 9999999.9
       or (p_operation->>'package_size')::numeric * 10 <> trunc((p_operation->>'package_size')::numeric * 10) then
      return jsonb_build_object('operation_id', p_operation->'operation_id', 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
    end if;
  end if;

  v_operation_id := (p_operation->>'operation_id')::uuid;
  v_household_id := (p_operation->>'household_id')::uuid;
  v_created_at := (p_operation->>'created_at')::timestamptz;
  v_effective_created_at := case
    when v_created_at > now() + interval '5 minutes' then now()
    else v_created_at
  end;
  if v_actor_id is null or not coalesce((select private.is_household_member(v_household_id)), false) then
    raise exception 'not a household member' using errcode = '42501';
  end if;

  if v_type = 'insert_inventory' and (p_operation->>'item_id')::uuid = (p_operation->>'in_transaction_id')::uuid then
    return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1,
      'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
  end if;
  if v_type = 'consume_inventory' then
    v_mode := p_operation->>'mode';
    if v_mode not in ('sealed_full', 'sealed_partial', 'opened')
       or (p_operation->>'consumed_quantity')::numeric <= 0
       or (p_operation->>'expected_quantity')::numeric <= 0
       or (p_operation->>'consumed_quantity')::numeric > (p_operation->>'expected_quantity')::numeric then
      return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
    end if;
    if v_mode = 'sealed_partial' then
      if not (p_operation ? 'opened_item_id') or not (p_operation ? 'portion_quantity')
         or not (p_operation ? 'remainder_quantity') or not (p_operation ? 'opened_at')
         or not (p_operation ? 'expiry_date') or not (p_operation ? 'vacuum_sealed')
         or not (p_operation ? 'expiry_user_set') or not (p_operation ? 'merge_snapshot')
         or (p_operation->>'consumed_quantity')::numeric >= (p_operation->>'portion_quantity')::numeric
         or (p_operation->>'portion_quantity')::numeric > (p_operation->>'expected_quantity')::numeric
         or (p_operation->>'remainder_quantity')::numeric <>
            (p_operation->>'portion_quantity')::numeric - (p_operation->>'consumed_quantity')::numeric
         or (p_operation->>'remainder_quantity')::numeric <= 0
         or jsonb_typeof(p_operation->'merge_snapshot') <> 'object' then
        return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1,
          'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
      end if;
    end if;
  elsif v_type = 'waste_inventory' then
    if p_operation->>'reason' not in ('expired', 'spoiled', 'other')
       or (p_operation->>'waste_quantity')::numeric <= 0
       or (p_operation->>'waste_quantity')::numeric > (p_operation->>'expected_quantity')::numeric then
      return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
    end if;
  elsif v_type = 'move_inventory' then
    if (p_operation->>'out_transaction_id')::uuid = (p_operation->>'in_transaction_id')::uuid
       or (p_operation->>'expected_location_id')::uuid = (p_operation->>'to_location_id')::uuid
       or p_operation->>'location_id' <> p_operation->>'expected_location_id' then
      return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
    end if;
  elsif v_type = 'correct_quantity'
        and (p_operation->>'new_quantity')::numeric = (p_operation->>'expected_quantity')::numeric then
    return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1,
      'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED');
  end if;

  v_hash := md5(p_operation::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_operation_id::text, 0));
  select t.operation_payload_hash into v_existing_hash
  from public.transactions t
  where t.operation_id = v_operation_id
  limit 1
  for update;
  if found then
    if v_existing_hash is distinct from v_hash then
      return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'ID_PAYLOAD_MISMATCH');
    end if;
    return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1,
      'kind', 'replayed', 'transactions', '[]'::jsonb, 'lots', '[]'::jsonb);
  end if;

  if v_type = 'insert_inventory' then
    if (p_operation->'package_size' = 'null'::jsonb) <> (p_operation->'package_size_unit' = 'null'::jsonb)
       or length(trim(p_operation->>'name')) = 0
       or length(p_operation->>'name') > 200
       or exists (select 1 from public.fridge_items where id = (p_operation->>'item_id')::uuid)
       or exists (select 1 from public.transactions where id = (p_operation->>'in_transaction_id')::uuid)
       or not exists (
         select 1 from public.storage_locations
         where id = (p_operation->>'location_id')::uuid
           and household_id = v_household_id and deleted_at is null
       ) then
      return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', 'STALE_BASE');
    end if;
    insert into public.fridge_items (
      id, household_id, location_id, product_id, name, quantity, unit, expiry_date, added_by,
      created_at, updated_at, package_size, package_size_unit, opened_at, vacuum_sealed, expiry_user_set
    ) values (
      (p_operation->>'item_id')::uuid, v_household_id, (p_operation->>'location_id')::uuid,
      nullif(p_operation->>'product_id', '')::uuid, p_operation->>'name', (p_operation->>'quantity')::numeric,
      p_operation->>'unit', nullif(p_operation->>'expiry_date', '')::date, v_actor_id,
      v_effective_created_at, v_effective_created_at, nullif(p_operation->>'package_size', '')::numeric,
      nullif(p_operation->>'package_size_unit', ''), nullif(p_operation->>'opened_at', '')::timestamptz,
      (p_operation->>'vacuum_sealed')::boolean, (p_operation->>'expiry_user_set')::boolean
    );
    insert into public.transactions (
      id, operation_id, operation_payload_hash, household_id, fridge_item_id, product_id, actor,
      type, quantity, unit, location_id, created_at
    ) values (
      (p_operation->>'in_transaction_id')::uuid, v_operation_id, v_hash, v_household_id,
      (p_operation->>'item_id')::uuid, nullif(p_operation->>'product_id', '')::uuid, v_actor_id,
      'in', (p_operation->>'quantity')::numeric, p_operation->>'unit', (p_operation->>'location_id')::uuid,
      v_effective_created_at
    );
    v_lot_ids := array[(p_operation->>'item_id')::uuid];
    v_ledger_ids := array[(p_operation->>'in_transaction_id')::uuid];
  elsif v_type = 'consume_inventory' then
    select * into v_lot from public.fridge_items
    where id = (p_operation->>'source_item_id')::uuid and household_id = v_household_id
    for update;
    if not found or v_lot.deleted_at is not null
       or v_lot.quantity <> (p_operation->>'expected_quantity')::numeric
       or v_lot.product_id is distinct from nullif(p_operation->>'product_id', '')::uuid
       or v_lot.unit <> p_operation->>'unit'
       or v_lot.location_id <> (p_operation->>'location_id')::uuid then
      return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1,
        'kind', 'conflict', 'code', case when found and v_lot.quantity < (p_operation->>'consumed_quantity')::numeric then 'INSUFFICIENT_QUANTITY' else 'STALE_BASE' end);
    end if;
    if v_mode = 'sealed_full' and v_lot.opened_at is not null then
      return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1, 'kind', 'conflict', 'code', 'STALE_BASE');
    end if;
    if v_mode = 'opened' and v_lot.opened_at is null then
      return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1, 'kind', 'conflict', 'code', 'STALE_BASE');
    end if;
    if v_mode = 'sealed_partial' then
      v_portion := (p_operation->>'portion_quantity')::numeric;
      v_remainder := (p_operation->>'remainder_quantity')::numeric;
      if v_lot.opened_at is not null or v_lot.package_size is null or v_lot.package_size <> v_portion
         or v_portion > v_lot.quantity or v_remainder <> v_portion - (p_operation->>'consumed_quantity')::numeric
         or (p_operation->'merge_snapshot'->>'quantity_before')::numeric <> v_lot.quantity
         or (p_operation->'merge_snapshot'->>'household_id')::uuid <> v_lot.household_id
         or (p_operation->'merge_snapshot'->>'location_id')::uuid <> v_lot.location_id then
        return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1, 'kind', 'conflict', 'code', 'STALE_BASE');
      end if;
      if exists (select 1 from public.fridge_items where id = (p_operation->>'opened_item_id')::uuid) then
        return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1, 'kind', 'conflict', 'code', 'STALE_BASE');
      end if;
      v_new_quantity := v_lot.quantity - v_portion;
      update public.fridge_items
      set quantity = v_new_quantity, deleted_at = case when v_new_quantity = 0 then v_effective_created_at else null end
      where id = v_lot.id;
      insert into public.fridge_items (
        id, household_id, location_id, product_id, name, quantity, unit, expiry_date, added_by,
        created_at, updated_at, package_size, package_size_unit, opened_at, vacuum_sealed, expiry_user_set
      ) values (
        (p_operation->>'opened_item_id')::uuid, v_lot.household_id, v_lot.location_id, v_lot.product_id,
        v_lot.name, v_remainder, v_lot.unit, nullif(p_operation->>'expiry_date', '')::date,
        coalesce(v_lot.added_by, v_actor_id), v_effective_created_at, v_effective_created_at,
        v_lot.package_size, v_lot.package_size_unit, (p_operation->>'opened_at')::timestamptz,
        (p_operation->>'vacuum_sealed')::boolean, (p_operation->>'expiry_user_set')::boolean
      );
      v_lot_ids := array[v_lot.id, (p_operation->>'opened_item_id')::uuid];
      v_transaction_type := 'out';
      v_quantity := (p_operation->>'consumed_quantity')::numeric;
    else
      v_new_quantity := v_lot.quantity - (p_operation->>'consumed_quantity')::numeric;
      update public.fridge_items
      set quantity = v_new_quantity, deleted_at = case when v_new_quantity = 0 then v_effective_created_at else null end
      where id = v_lot.id;
      v_lot_ids := array[v_lot.id];
      v_transaction_type := 'out';
      v_quantity := (p_operation->>'consumed_quantity')::numeric;
    end if;
    insert into public.transactions (
      id, operation_id, operation_payload_hash, household_id, fridge_item_id, product_id, actor,
      type, quantity, unit, location_id, notes, created_at
    ) values (
      (p_operation->>'out_transaction_id')::uuid, v_operation_id, v_hash, v_household_id,
      case when v_mode = 'sealed_partial' then (p_operation->>'opened_item_id')::uuid else v_lot.id end,
      v_lot.product_id, v_actor_id, v_transaction_type, v_quantity, v_lot.unit, v_lot.location_id,
      null, v_effective_created_at
    );
    v_ledger_ids := array[(p_operation->>'out_transaction_id')::uuid];
  elsif v_type = 'waste_inventory' then
    select * into v_lot from public.fridge_items
    where id = (p_operation->>'item_id')::uuid and household_id = v_household_id
    for update;
    if not found or v_lot.deleted_at is not null or v_lot.quantity <> (p_operation->>'expected_quantity')::numeric
       or v_lot.product_id is distinct from nullif(p_operation->>'product_id', '')::uuid
       or v_lot.unit <> p_operation->>'unit' or v_lot.location_id <> (p_operation->>'location_id')::uuid then
      return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1, 'kind', 'conflict',
        'code', case when found and v_lot.quantity < (p_operation->>'waste_quantity')::numeric then 'INSUFFICIENT_QUANTITY' else 'STALE_BASE' end);
    end if;
    v_new_quantity := v_lot.quantity - (p_operation->>'waste_quantity')::numeric;
    update public.fridge_items
    set quantity = v_new_quantity, deleted_at = case when v_new_quantity = 0 then v_effective_created_at else null end
    where id = v_lot.id;
    insert into public.transactions (
      id, operation_id, operation_payload_hash, household_id, fridge_item_id, product_id, actor,
      type, quantity, unit, location_id, reason, created_at
    ) values (
      (p_operation->>'waste_transaction_id')::uuid, v_operation_id, v_hash, v_household_id, v_lot.id,
      v_lot.product_id, v_actor_id, 'waste', (p_operation->>'waste_quantity')::numeric, v_lot.unit,
      v_lot.location_id, p_operation->>'reason', v_effective_created_at
    );
    v_lot_ids := array[v_lot.id];
    v_ledger_ids := array[(p_operation->>'waste_transaction_id')::uuid];
  elsif v_type = 'move_inventory' then
    select * into v_lot from public.fridge_items
    where id = (p_operation->>'item_id')::uuid and household_id = v_household_id
    for update;
    if not found or v_lot.deleted_at is not null or v_lot.quantity <> (p_operation->>'expected_quantity')::numeric
       or v_lot.location_id <> (p_operation->>'expected_location_id')::uuid
       or v_lot.product_id is distinct from nullif(p_operation->>'product_id', '')::uuid
       or v_lot.unit <> p_operation->>'unit'
       or not exists (select 1 from public.storage_locations where id = (p_operation->>'to_location_id')::uuid
          and household_id = v_household_id and deleted_at is null) then
      return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1, 'kind', 'conflict', 'code', 'STALE_BASE');
    end if;
    update public.fridge_items
    set location_id = (p_operation->>'to_location_id')::uuid
    where id = v_lot.id;
    insert into public.transactions (
      id, operation_id, operation_payload_hash, household_id, fridge_item_id, product_id, actor,
      type, quantity, unit, location_id, created_at
    ) values
      ((p_operation->>'out_transaction_id')::uuid, v_operation_id, v_hash, v_household_id, v_lot.id,
       v_lot.product_id, v_actor_id, 'out', v_lot.quantity, v_lot.unit, v_lot.location_id, v_effective_created_at),
      ((p_operation->>'in_transaction_id')::uuid, v_operation_id, v_hash, v_household_id, v_lot.id,
       v_lot.product_id, v_actor_id, 'in', v_lot.quantity, v_lot.unit, (p_operation->>'to_location_id')::uuid, v_effective_created_at);
    v_lot_ids := array[v_lot.id];
    v_ledger_ids := array[(p_operation->>'out_transaction_id')::uuid, (p_operation->>'in_transaction_id')::uuid];
  else
    select * into v_lot from public.fridge_items
    where id = (p_operation->>'item_id')::uuid and household_id = v_household_id
    for update;
    if not found or v_lot.deleted_at is not null or v_lot.quantity <> (p_operation->>'expected_quantity')::numeric
       or v_lot.product_id is distinct from nullif(p_operation->>'product_id', '')::uuid
       or v_lot.unit <> p_operation->>'unit' or v_lot.location_id <> (p_operation->>'location_id')::uuid then
      return jsonb_build_object('operation_id', v_operation_id, 'contract_version', 1, 'kind', 'conflict', 'code', 'STALE_BASE');
    end if;
    v_new_quantity := (p_operation->>'new_quantity')::numeric;
    v_delta := abs(v_new_quantity - v_lot.quantity);
    update public.fridge_items
    set quantity = v_new_quantity, deleted_at = case when v_new_quantity = 0 then v_effective_created_at else null end
    where id = v_lot.id;
    insert into public.transactions (
      id, operation_id, operation_payload_hash, household_id, fridge_item_id, product_id, actor,
      type, quantity, unit, location_id, notes, created_at
    ) values (
      (p_operation->>'transaction_id')::uuid, v_operation_id, v_hash, v_household_id, v_lot.id,
      v_lot.product_id, v_actor_id, case when v_new_quantity > v_lot.quantity then 'in' else 'out' end,
      v_delta, v_lot.unit, v_lot.location_id, '[Manual correction]', v_effective_created_at
    );
    v_lot_ids := array[v_lot.id];
    v_ledger_ids := array[(p_operation->>'transaction_id')::uuid];
  end if;

  return jsonb_build_object(
    'operation_id', v_operation_id,
    'contract_version', 1,
    'kind', 'applied',
    'lots', coalesce((select jsonb_agg(to_jsonb(fi) order by fi.id) from public.fridge_items fi where fi.id = any(v_lot_ids)), '[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(to_jsonb(tx) order by tx.id) from public.transactions tx where tx.id = any(v_ledger_ids)), '[]'::jsonb)
  );
exception
  when others then
    get stacked diagnostics v_key = returned_sqlstate;
    if v_key = '42501' then raise; end if;
    return jsonb_build_object(
      'operation_id', case when p_operation ? 'operation_id' then p_operation->'operation_id' else null end,
      'contract_version', 1, 'kind', 'invalid', 'code', 'PAYLOAD_VALIDATION_FAILED'
    );
end;
$function$;

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
  if uid is null then raise exception 'Nicht angemeldet'; end if;
  insert into public.households (name, created_by) values (household_name, uid) returning id into new_id;
  insert into public.household_members (household_id, user_id, role) values (new_id, uid, 'admin');
  insert into public.storage_locations (household_id, name, kind, sort_order)
  values (new_id, 'Kühlschrank', 'fridge', 0), (new_id, 'Tiefkühltruhe', 'freezer', 1),
    (new_id, 'Abstellkammer', 'pantry', 2);
  return new_id;
end;
$$;
