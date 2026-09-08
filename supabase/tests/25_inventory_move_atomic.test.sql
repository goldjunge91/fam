-- Atomarer Inventory-Move: Bestand und append-only Ledger werden als eine
-- idempotente Mehrzeilenmutation ueber den RPC verarbeitet.

begin;
\ir helpers.sql

select plan(13);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.as_postgres();
select ok(
  has_function_privilege(
    'authenticated',
    'public.move_fridge_item(uuid, uuid, uuid, uuid, uuid, bigint, uuid, uuid, timestamptz)',
    'execute'
  ),
  'authenticated darf den atomaren Move-RPC ausfuehren'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.move_fridge_item(uuid, uuid, uuid, uuid, uuid, bigint, uuid, uuid, timestamptz)',
    'execute'
  ),
  'anon darf den atomaren Move-RPC nicht ausfuehren'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Move-Test-Haushalt') as household_id \gset
select id as old_location_id
from public.storage_locations
where household_id = :'household_id' and kind = 'fridge'
limit 1 \gset
select id as new_location_id
from public.storage_locations
where household_id = :'household_id' and kind = 'pantry'
limit 1 \gset

insert into public.fridge_items (
  id, household_id, location_id, name, quantity, unit, added_by
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', :'household_id', :'old_location_id',
  'Move-Milch', 2000, 'piece', '11111111-1111-1111-1111-111111111111'
);

select public.move_fridge_item(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id',
  :'old_location_id',
  :'new_location_id',
  2000,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '2026-09-07T10:00:00Z'
) as moved_id \gset

select is(
  :'moved_id'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'der RPC gibt die verschobene Bestands-ID zurueck'
);
select is(
  (select location_id from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  :'new_location_id'::uuid,
  'der Bestand wird zusammen mit dem Move an den neuen Lagerort gesetzt'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2,
  'ein Move erzeugt genau eine out- und eine in-Ledgerzeile'
);
select set_eq(
  $$ select type, location_id::text from public.transactions
     where operation_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  format($$ values ('out', %L), ('in', %L) $$, :'old_location_id', :'new_location_id'),
  'die beiden Ledgerzeilen tragen die alten und neuen Lagerorte'
);

select public.move_fridge_item(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id',
  :'old_location_id',
  :'new_location_id',
  2000,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '2026-09-07T10:00:00Z'
) as retry_id \gset
select is(
  :'retry_id'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'ein Retry derselben operation_id ist erfolgreich'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2,
  'ein RPC-Retry dupliziert keine Ledgerzeilen'
);

-- Die erste Ledgerzeile kollidiert absichtlich mit dem bereits erfolgreichen
-- Move. Der Fehler tritt nach dem UPDATE des Bestands auf; PostgreSQL muss
-- deshalb das gesamte RPC und nicht nur den fehlschlagenden INSERT zurueckrollen.
select throws_ok(
  format(
    $$ select public.move_fridge_item(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      %L, %L, null, 2000,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '2026-09-07T10:00:00Z'
    ) $$,
    :'household_id', :'new_location_id'
  ),
  '23505', null,
  'ein Ledger-Fehler rollt auch das vorherige Bestands-UPDATE zurueck'
);
select is(
  (select location_id from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  :'new_location_id'::uuid,
  'nach einem fehlgeschlagenen Move bleibt der Bestand am neuen Lagerort'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  0,
  'nach einem fehlgeschlagenen Move bleibt das Ledger unveraendert'
);

select throws_ok(
  format(
    $$ select public.move_fridge_item(
      '99999999-9999-4999-8999-999999999999',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      %L, %L, null, 2000,
      '12121212-1212-4121-8121-121212121212',
      '13131313-1313-4131-8131-131313131313',
      '2026-09-07T10:00:00Z'
    ) $$,
    :'household_id', :'old_location_id'
  ),
  'P0001', null,
  'ein veralteter erwarteter Lagerort wird abgelehnt'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  format(
    $$ select public.move_fridge_item(
      '14141414-1414-4141-8141-141414141414',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      %L, %L, null, 2000,
      '15151515-1515-4151-8151-151515151515',
      '16161616-1616-4161-8161-161616161616',
      '2026-09-07T10:00:00Z'
    ) $$,
    :'household_id', :'new_location_id'
  ),
  'P0001', null,
  'ein Nichtmitglied kann keinen Move eines fremden Haushalts ausfuehren'
);

select * from finish();
rollback;
