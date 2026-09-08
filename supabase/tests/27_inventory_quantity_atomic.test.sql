-- Atomare und idempotente Mengenänderung gegen den aktuellen Serverbestand.

begin;
\ir helpers.sql

select plan(19);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.as_postgres();
select ok(
  has_function_privilege(
    'authenticated',
    'public.adjust_fridge_item_quantity(uuid, uuid, uuid, uuid, numeric, timestamptz)',
    'execute'
  ),
  'authenticated darf den atomaren Mengen-RPC ausführen'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.adjust_fridge_item_quantity(uuid, uuid, uuid, uuid, numeric, timestamptz)',
    'execute'
  ),
  'anon darf den atomaren Mengen-RPC nicht ausführen'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Mengen-Test-Haushalt') as household_id \gset
select id as location_id
from public.storage_locations
where household_id = :'household_id' and kind = 'fridge'
limit 1 \gset

insert into public.fridge_items (
  id, household_id, location_id, name, quantity, unit, added_by
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', :'household_id', :'location_id',
  'Mengen-Milch', 5, 'piece', '11111111-1111-1111-1111-111111111111'
);

select public.adjust_fridge_item_quantity(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id',
  -2,
  '2026-09-07T10:00:00Z'
) as adjusted_id \gset

select is(
  :'adjusted_id'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'der RPC gibt die Bestands-ID zurück'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  3::numeric,
  'das Delta wird gegen die aktuelle Servermenge gebucht'
);
select is(
  (select deleted_at from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  null::timestamptz,
  'ein positiver Restbestand bleibt aktiv'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'eine Mengenoperation erzeugt genau eine Ledgerzeile'
);
select set_eq(
  $$ select type, quantity, location_id::text
     from public.transactions
     where operation_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  format($$ values ('out', 2::numeric, %L) $$, :'location_id'),
  'die Ledgerzeile trägt Richtung, effektive Menge und Lagerort'
);

update public.fridge_items
set location_id = null
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select public.adjust_fridge_item_quantity(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id',
  -2,
  '2026-09-07T10:00:00Z'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  3::numeric,
  'ein Mengen-Retry bleibt auch nach einem zwischenzeitlichen Move idempotent'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'ein Mengen-Retry nach einem Move dupliziert keine Ledgerzeile'
);

select throws_ok(
  format(
    $$ select public.adjust_fridge_item_quantity(
      '14141414-1414-4141-8141-141414141414',
      '15151515-1515-4151-8151-151515151515',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      %L, -0.0001, '2026-09-07T10:00:30Z'
    ) $$,
    :'household_id'
  ),
  'P0001', 'Mengen duerfen hoechstens drei Nachkommastellen haben',
  'der RPC weist ein Delta mit mehr als drei Nachkommastellen zurueck'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  3::numeric,
  'ein unpraezises Delta veraendert den Bestand nicht'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = '14141414-1414-4141-8141-141414141414'),
  0,
  'ein unpraezises Delta schreibt kein Ledger'
);

select public.adjust_fridge_item_quantity(
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id',
  -3,
  '2026-09-07T10:01:00Z'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::numeric,
  'vollständiger Verbrauch schreibt serverseitig Menge null'
);
select isnt(
  (select deleted_at from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  null::timestamptz,
  'vollständiger Verbrauch erzeugt serverseitig einen Tombstone'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
  1,
  'vollständiger Verbrauch erzeugt genau eine Ledgerzeile'
);

select throws_ok(
  format(
    $$ select public.adjust_fridge_item_quantity(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      %L, -4, '2026-09-07T10:01:00Z'
    ) $$,
    :'household_id'
  ),
  'P0001', null,
  'ein Delta unter null wird abgelehnt'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::numeric,
  'ein abgelehntes Delta verändert den Bestand nicht'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  0,
  'ein abgelehntes Delta schreibt kein Ledger'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  format(
    $$ select public.adjust_fridge_item_quantity(
      '12121212-1212-4121-8121-121212121212',
      '13131313-1313-4131-8131-131313131313',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      %L, -1, '2026-09-07T10:02:00Z'
    ) $$,
    :'household_id'
  ),
  'P0001', null,
  'ein Nichtmitglied kann keine Mengenänderung ausführen'
);

select * from finish();
rollback;
