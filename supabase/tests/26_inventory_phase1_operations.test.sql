-- Phase 1: genau die fünf kanonischen Inventory-Operationen über einen RPC.

begin;
\ir helpers.sql

select plan(25);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice-phase1@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol-phase1@example.com');
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Inventory Phase 1') as household_id \gset
select id as fridge_location_id
  from public.storage_locations
 where household_id = :'household_id' and kind = 'fridge'
 order by sort_order
 limit 1 \gset
select id as pantry_location_id
  from public.storage_locations
 where household_id = :'household_id' and kind = 'pantry'
 order by sort_order
 limit 1 \gset

select jsonb_build_object(
  'contract_version', 1,
  'type', 'insert_inventory',
  'operation_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'household_id', :'household_id'::uuid,
  'created_at', '2026-09-10T10:00:00Z',
  'item_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'in_transaction_id', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
  'quantity', 10.0,
  'product_id', null::uuid,
  'name', 'Milch',
  'unit', 'piece',
  'package_size', 10.0,
  'package_size_unit', 'piece',
  'location_id', :'fridge_location_id'::uuid,
  'expiry_date', null::date,
  'opened_at', null::timestamptz,
  'vacuum_sealed', true,
  'expiry_user_set', false
) as insert_op \gset

select is(
  public.apply_inventory_operation(:'insert_op'::jsonb)->>'kind',
  'applied',
  'insert_inventory wird atomar angewendet'
);
select is(
  (select quantity from public.fridge_items where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  10.0::numeric,
  'insert_inventory legt die physische Menge an'
);
select is(
  (select type from public.transactions where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  'in',
  'insert_inventory schreibt eine IN-Ledgerzeile'
);
select is(
  public.apply_inventory_operation(:'insert_op'::jsonb)->>'kind',
  'replayed',
  'ein identischer Insert wird serverseitig idempotent wiedergegeben'
);
select is(
  public.apply_inventory_operation(
    jsonb_set(:'insert_op'::jsonb, '{quantity}', '9'::jsonb)
  )->>'code',
  'ID_PAYLOAD_MISMATCH',
  'dieselbe Operations-ID mit anderer Nutzlast wird abgewiesen'
);
select is(
  (select count(*)::int from public.transactions where operation_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1,
  'Idempotenz erzeugt keine zweite Ledgerzeile'
);

select jsonb_build_object(
  'contract_version', 1,
  'type', 'consume_inventory',
  'operation_id', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
  'household_id', :'household_id'::uuid,
  'created_at', '2026-09-10T10:01:00Z',
  'out_transaction_id', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
  'source_item_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'expected_quantity', 10.0,
  'consumed_quantity', 2.0,
  'product_id', null::uuid,
  'unit', 'piece',
  'location_id', :'fridge_location_id'::uuid,
  'mode', 'sealed_partial',
  'opened_item_id', 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,
  'portion_quantity', 10.0,
  'remainder_quantity', 8.0,
  'opened_at', '2026-09-10T10:01:00Z',
  'expiry_date', null::date,
  'vacuum_sealed', false,
  'expiry_user_set', false,
  'merge_snapshot', jsonb_build_object(
    'household_id', :'household_id'::uuid,
    'product_id', null::uuid,
    'name', 'Milch',
    'unit', 'piece',
    'package_size', 10.0,
    'package_size_unit', 'piece',
    'location_id', :'fridge_location_id'::uuid,
    'expiry_date', null::date,
    'opened_at', null::timestamptz,
    'vacuum_sealed', true,
    'expiry_user_set', false,
    'added_by', '11111111-1111-1111-1111-111111111111'::uuid,
    'quantity_before', 10.0
  )
) as partial_consume_op \gset

select is(
  public.apply_inventory_operation(:'partial_consume_op'::jsonb)->>'kind',
  'applied',
  'sealed_partial verbraucht und öffnet atomar'
);
select is(
  (select quantity from public.fridge_items where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0.0::numeric,
  'das versiegelte Quell-Los wird als Tombstone auf null gesetzt'
);
select is(
  (select quantity from public.fridge_items where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
  8.0::numeric,
  'sealed_partial legt das geöffnete Rest-Los an'
);
select is(
  (select type from public.transactions where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'out',
  'sealed_partial schreibt genau eine OUT-Ledgerzeile'
);
select is(
  (select fridge_item_id from public.transactions where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,
  'die OUT-Ledgerzeile zeigt auf das geöffnete Los'
);
select is(
  (select count(*)::int from public.transactions where type = 'open'),
  0,
  'Phase 1 kennt keinen OPEN-Ledgertyp'
);

select jsonb_build_object(
  'contract_version', 1,
  'type', 'consume_inventory',
  'operation_id', '11111111-1111-4111-8111-111111111111'::uuid,
  'household_id', :'household_id'::uuid,
  'created_at', '2026-09-10T10:02:00Z',
  'out_transaction_id', '22222222-2222-4222-8222-222222222222'::uuid,
  'source_item_id', 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,
  'expected_quantity', 7.0,
  'consumed_quantity', 1.0,
  'product_id', null::uuid,
  'unit', 'piece',
  'location_id', :'fridge_location_id'::uuid,
  'mode', 'opened'
) as stale_consume_op \gset
select is(
  public.apply_inventory_operation(:'stale_consume_op'::jsonb)->>'code',
  'STALE_BASE',
  'ein veralteter Consume-Stand wird als Konflikt gemeldet'
);

select tests.as_postgres();
update public.fridge_items
   set quantity = 1.0
 where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select jsonb_set(:'stale_consume_op'::jsonb, '{operation_id}', to_jsonb('33333333-3333-4333-8333-333333333333'::uuid)) as insufficient_op \gset
select is(
  public.apply_inventory_operation(
    jsonb_set(
      jsonb_set(:'insufficient_op'::jsonb, '{expected_quantity}', '2'::jsonb),
      '{consumed_quantity}',
      '2'::jsonb
    )
  )->>'code',
  'INSUFFICIENT_QUANTITY',
  'zu wenig aktueller Bestand wird als Fachkonflikt gemeldet'
);

select jsonb_build_object(
  'contract_version', 1,
  'type', 'insert_inventory',
  'operation_id', '44444444-4444-4444-8444-444444444444'::uuid,
  'household_id', :'household_id'::uuid,
  'created_at', '2026-09-10T10:03:00Z',
  'item_id', '55555555-5555-4555-8555-555555555555'::uuid,
  'in_transaction_id', '66666666-6666-4666-8666-666666666666'::uuid,
  'quantity', 4.0,
  'product_id', null::uuid,
  'name', 'Joghurt',
  'unit', 'piece',
  'package_size', null::numeric,
  'package_size_unit', null::text,
  'location_id', :'fridge_location_id'::uuid,
  'expiry_date', null::date,
  'opened_at', null::timestamptz,
  'vacuum_sealed', false,
  'expiry_user_set', false
) as second_insert_op \gset
select is(public.apply_inventory_operation(:'second_insert_op'::jsonb)->>'kind', 'applied', 'zweiter Bestand für Waste und Move');

select jsonb_build_object(
  'contract_version', 1,
  'type', 'waste_inventory',
  'operation_id', '77777777-7777-4777-8777-777777777777'::uuid,
  'household_id', :'household_id'::uuid,
  'created_at', '2026-09-10T10:04:00Z',
  'waste_transaction_id', '88888888-8888-4888-8888-888888888888'::uuid,
  'item_id', '55555555-5555-4555-8555-555555555555'::uuid,
  'expected_quantity', 4.0,
  'waste_quantity', 1.0,
  'reason', 'expired',
  'product_id', null::uuid,
  'unit', 'piece',
  'location_id', :'fridge_location_id'::uuid
) as waste_op \gset
select is(public.apply_inventory_operation(:'waste_op'::jsonb)->>'kind', 'applied', 'waste_inventory wird angewendet');
select is((select quantity from public.fridge_items where id = '55555555-5555-4555-8555-555555555555'), 3.0::numeric, 'Waste zieht die Menge ab');
select is((select reason from public.transactions where id = '88888888-8888-4888-8888-888888888888'), 'expired', 'Waste schreibt den Grund');

select jsonb_build_object(
  'contract_version', 1,
  'type', 'move_inventory',
  'operation_id', '99999999-9999-4999-8999-999999999999'::uuid,
  'household_id', :'household_id'::uuid,
  'created_at', '2026-09-10T10:05:00Z',
  'out_transaction_id', 'abababab-abab-4bab-8bab-abababababab'::uuid,
  'in_transaction_id', 'cdcdcdcd-cdcd-4cdc-8dcd-cdcdcdcdcdcd'::uuid,
  'item_id', '55555555-5555-4555-8555-555555555555'::uuid,
  'expected_quantity', 3.0,
  'expected_location_id', :'fridge_location_id'::uuid,
  'to_location_id', :'pantry_location_id'::uuid,
  'product_id', null::uuid,
  'unit', 'piece',
  'location_id', :'fridge_location_id'::uuid
) as move_op \gset
select is(public.apply_inventory_operation(:'move_op'::jsonb)->>'kind', 'applied', 'move_inventory wird angewendet');
select is((select location_id from public.fridge_items where id = '55555555-5555-4555-8555-555555555555'), :'pantry_location_id'::uuid, 'Move ändert den Lagerort');
select is((select count(*)::int from public.transactions where operation_id = '99999999-9999-4999-8999-999999999999'), 2, 'Move schreibt beide Ledgerlegs');

select jsonb_build_object(
  'contract_version', 1,
  'type', 'correct_quantity',
  'operation_id', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
  'household_id', :'household_id'::uuid,
  'created_at', '2026-09-10T10:06:00Z',
  'transaction_id', 'fefefefe-fefe-4fef-8fef-fefefefefefe'::uuid,
  'item_id', '55555555-5555-4555-8555-555555555555'::uuid,
  'expected_quantity', 3.0,
  'new_quantity', 2.0,
  'product_id', null::uuid,
  'unit', 'piece',
  'location_id', :'pantry_location_id'::uuid
) as correction_op \gset
select is(public.apply_inventory_operation(:'correction_op'::jsonb)->>'kind', 'applied', 'correct_quantity wird angewendet');
select is((select quantity from public.fridge_items where id = '55555555-5555-4555-8555-555555555555'), 2.0::numeric, 'correct_quantity setzt den neuen Bestand');
select is((select notes from public.transactions where id = 'fefefefe-fefe-4fef-8fef-fefefefefefe'), '[Manual correction]', 'Korrekturen sind im Ledger erkennbar');

select tests.authenticate_as_anon();
select throws_ok(
  $$select public.apply_inventory_operation('{}'::jsonb)$$,
  '42501',
  NULL,
  'anonyme Requests dürfen keine Inventory-Operation ausführen'
);

select * from finish();
rollback;
