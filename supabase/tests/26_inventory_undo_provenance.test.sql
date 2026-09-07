-- Atomare und idempotente Move-Gegenbuchung mit maschinenlesbarer Provenienz.

begin;
\ir helpers.sql

select plan(10);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.as_postgres();
select ok(
  has_function_privilege(
    'authenticated',
    'public.reverse_move_fridge_item(uuid, uuid, uuid, uuid, uuid, uuid, numeric, uuid, uuid, timestamptz, text)',
    'execute'
  ),
  'authenticated darf den Undo-Move-RPC ausführen'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.reverse_move_fridge_item(uuid, uuid, uuid, uuid, uuid, uuid, numeric, uuid, uuid, timestamptz, text)',
    'execute'
  ),
  'anon darf den Undo-Move-RPC nicht ausführen'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Undo-Test-Haushalt') as household_id \gset
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
  'Undo-Milch', 2, 'piece', '11111111-1111-1111-1111-111111111111'
);

select public.move_fridge_item(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id',
  :'old_location_id',
  :'new_location_id',
  2,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '2026-09-07T10:00:00Z'
);

select public.reverse_move_fridge_item(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id',
  :'new_location_id',
  :'old_location_id',
  2,
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  '99999999-9999-4999-8999-999999999999',
  '2026-09-07T10:01:00Z',
  '[Undone] Gegenbuchung'
);

select is(
  (select location_id from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  :'old_location_id'::uuid,
  'die Gegenbuchung setzt den Bestand atomar an den ursprünglichen Lagerort'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  2,
  'die Gegenbuchung erzeugt genau zwei Ledgerzeilen'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = 'eeeeeeee-eeee-eeee-8eee-eeeeeeeeeeee'),
  0,
  'eine fremde operation_id wird nicht versehentlich angelegt'
);
select set_eq(
  $$ select type, reversal_of::text, notes
     from public.transactions
     where operation_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  $$ values
    ('out', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '[Undone] Gegenbuchung'),
    ('in', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '[Undone] Gegenbuchung') $$,
  'beide Gegenlegs tragen operation_id-Provenienz und Undo-Kennzeichnung'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2,
  'der historische Ursprung bleibt unverändert erhalten'
);

select public.reverse_move_fridge_item(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id',
  :'new_location_id',
  :'old_location_id',
  2,
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  '99999999-9999-4999-8999-999999999999',
  '2026-09-07T10:01:00Z',
  '[Undone] Gegenbuchung'
);
select is(
  (select count(*)::int from public.transactions
   where reversal_of = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2,
  'ein RPC-Retry dupliziert die Gegenbuchung nicht'
);
select is(
  (select location_id from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  :'old_location_id'::uuid,
  'ein RPC-Retry verändert den Lagerort nicht erneut'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  format(
    $$ select public.reverse_move_fridge_item(
      '12121212-1212-4121-8121-121212121212',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      %L, %L, %L, 2,
      '13131313-1313-4131-8131-131313131313',
      '14141414-1414-4141-8141-141414141414',
      '2026-09-07T10:02:00Z', '[Undone] Gegenbuchung'
    ) $$,
    :'household_id', :'old_location_id', :'new_location_id'
  ),
  'P0001', null,
  'ein Nichtmitglied kann keine Move-Gegenbuchung ausführen'
);

select * from finish();
rollback;
