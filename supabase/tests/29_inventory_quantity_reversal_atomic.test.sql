-- Mengen-Undo muss Bestand und Gegenbuchung atomar und idempotent schreiben.

begin;
\ir helpers.sql

select plan(15);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.as_postgres();
select ok(
  has_function_privilege(
    'authenticated',
    'public.reverse_inventory_quantity_transaction(uuid, uuid, uuid, uuid, timestamptz, text)',
    'execute'
  ),
  'authenticated darf eine Mengenbuchung atomar umkehren'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.reverse_inventory_quantity_transaction(uuid, uuid, uuid, uuid, timestamptz, text)',
    'execute'
  ),
  'anon darf keine Mengenbuchung umkehren'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Mengen-Undo-Test') as household_id \gset
select id as location_id
from public.storage_locations
where household_id = :'household_id' and kind = 'fridge'
limit 1 \gset

insert into public.fridge_items (
  id, household_id, location_id, name, quantity, unit, added_by
)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', :'household_id', :'location_id', 'Milch A', 3000, 'piece', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', :'household_id', :'location_id', 'Milch B', 3000, 'piece', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac', :'household_id', :'location_id', 'Milch C', 3000, 'piece', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad', :'household_id', :'location_id', 'Milch D', 3000, 'piece', '11111111-1111-1111-1111-111111111111');

insert into public.transactions (
  id, operation_id, household_id, fridge_item_id, actor, type, quantity,
  location_id, reason, created_at
)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'abababab-abab-4bab-8bab-abababababab', :'household_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'out', 1000, :'location_id', null, '2026-09-07T09:00:00Z'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc', null, :'household_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', '11111111-1111-1111-1111-111111111111', 'in', 2000, :'location_id', null, '2026-09-07T09:01:00Z'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbd', null, :'household_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac', '11111111-1111-1111-1111-111111111111', 'in', 3000, :'location_id', null, '2026-09-07T09:02:00Z'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbe', null, :'household_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad', '11111111-1111-1111-1111-111111111111', 'waste', 3000, :'location_id', 'spoiled', '2026-09-07T09:03:00Z');

update public.fridge_items
set deleted_at = now()
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad';

select public.reverse_inventory_quantity_transaction(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id', '2026-09-07T10:00:00Z', '[Undone] Gegenbuchung'
) as reversed_id \gset

select is(
  :'reversed_id'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'der RPC gibt die Bestands-ID zurueck'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  4000::bigint,
  'ein out wird durch ein in gegen den aktuellen Bestand umgekehrt'
);
select set_eq(
  $$ select type, quantity, reversal_of::text, notes
     from public.transactions
     where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' $$,
  $$ values ('in', 1000::bigint, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '[Undone] Gegenbuchung') $$,
  'die Gegenbuchung traegt stabile ID und Provenienz'
);

select public.reverse_inventory_quantity_transaction(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id', '2026-09-07T10:00:00Z', '[Undone] Gegenbuchung'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  4000::bigint,
  'derselbe Retry aendert den Bestand nicht erneut'
);
select is(
  (select count(*)::int from public.transactions
   where reversal_of = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'derselbe Retry dupliziert die Gegenbuchung nicht'
);

select throws_ok(
  format(
    $$ select public.reverse_inventory_quantity_transaction(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      %L, '2026-09-07T10:00:01Z', '[Undone] Gegenbuchung'
    ) $$,
    :'household_id'
  ),
  'P0001', null,
  'eine zweite Reversal-ID fuer dieselbe Buchung wird abgelehnt'
);
select is(
  (select count(*)::int from public.transactions
   where reversal_of = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'auch eine konkurrierende zweite ID erzeugt nur eine Gegenbuchung'
);

select public.reverse_inventory_quantity_transaction(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccd',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',
  :'household_id', '2026-09-07T10:01:00Z', '[Undone] Gegenbuchung'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab'),
  1000::bigint,
  'ein in wird als out umgekehrt'
);

select public.reverse_inventory_quantity_transaction(
  'cccccccc-cccc-4ccc-8ccc-ccccccccccce',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbd',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac',
  :'household_id', '2026-09-07T10:02:00Z', '[Undone] Gegenbuchung'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac'),
  0::bigint,
  'ein vollstaendig umgekehrter Zugang setzt die Menge exakt auf null'
);
select isnt(
  (select deleted_at from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac'),
  null::timestamptz,
  'ein vollstaendig umgekehrter Zugang tombstoned den Bestand'
);

select public.reverse_inventory_quantity_transaction(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccf',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbe',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad',
  :'household_id', '2026-09-07T10:03:00Z', '[Undone] Gegenbuchung'
);
select is(
  (select deleted_at from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad'),
  null::timestamptz,
  'ein Waste-Undo stellt den Tombstone wieder her'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad'),
  3000::bigint,
  'ein Waste-Undo verdoppelt die erhaltene Menge nicht'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  format(
    $$ select public.reverse_inventory_quantity_transaction(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',
      %L, '2026-09-07T10:04:00Z', '[Undone] Gegenbuchung'
    ) $$,
    :'household_id'
  ),
  'P0001', null,
  'ein Nichtmitglied kann keine Buchung umkehren'
);

select * from finish();
rollback;
