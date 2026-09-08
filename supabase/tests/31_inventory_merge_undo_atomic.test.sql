-- Split-Undo (Merge) prueft Rest- und geoeffnetes Los gegen die Split-Buchung,
-- bevor beide Zeilen und die Gegenbuchung gemeinsam geschrieben werden.

begin;
\ir helpers.sql

select plan(13);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.as_postgres();
select ok(
  has_function_privilege(
    'authenticated',
    'public.merge_undo_fridge_item_open(uuid, uuid, uuid, timestamptz, text)',
    'execute'
  ),
  'authenticated darf einen Split atomar mergen'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.merge_undo_fridge_item_open(uuid, uuid, uuid, timestamptz, text)',
    'execute'
  ),
  'anon darf keinen Split mergen'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Merge-Undo-Test') as household_id \gset
select id as location_id
from public.storage_locations
where household_id = :'household_id' and kind = 'fridge'
limit 1 \gset

insert into public.fridge_items (
  id, household_id, location_id, name, quantity, unit, added_by, expiry_date, expiry_user_set
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', :'household_id', :'location_id',
  'Merge-Milch', 5000, 'piece', '11111111-1111-1111-1111-111111111111', '2026-12-31', true
);
select public.split_fridge_item_open(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  :'household_id', 5000, 1000, '2026-09-07T10:00:00Z', '2026-09-10', true,
  '2026-09-07T10:00:00Z'
);

select public.merge_undo_fridge_item_open(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  :'household_id', '2026-09-07T10:05:00Z', '[Undone] Öffnung rückgängig gemacht'
) as merged_id \gset

select is(
  :'merged_id'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'der RPC gibt die ID des versiegelten Loses zurueck'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  5000::bigint,
  'das versiegelte Los erhaelt die gesamte Menge zurueck'
);
select is(
  (select deleted_at is not null from public.fridge_items where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  true,
  'das geoeffnete Los wird weich geloescht'
);
select set_eq(
  $$ select type, quantity, reversal_of
     from public.transactions where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' $$,
  $$ values ('open', 1000::bigint, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid) $$,
  'die Gegenbuchung verweist auf die Split-Buchung'
);

-- Retry mit derselben Ledger-ID bleibt idempotent statt erneut zu schreiben.
select public.merge_undo_fridge_item_open(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  :'household_id', '2026-09-07T10:05:00Z', '[Undone] Öffnung rückgängig gemacht'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  5000::bigint,
  'ein Retry bleibt idempotent'
);
select is(
  (select count(*)::int from public.transactions where reversal_of = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'ein Retry dupliziert die Gegenbuchung nicht'
);

-- Zweiter Split, dessen geoeffnetes Los zwischenzeitlich veraendert wurde:
-- der Merge darf das nicht destruktiv ueberschreiben.
insert into public.fridge_items (
  id, household_id, location_id, name, quantity, unit, added_by, expiry_date, expiry_user_set
)
values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', :'household_id', :'location_id',
  'Merge-Konflikt-Milch', 5000, 'piece', '11111111-1111-1111-1111-111111111111', '2026-12-31', true
);
select public.split_fridge_item_open(
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '11111111-2222-4111-8111-111111111111',
  :'household_id', 5000, 1000, '2026-09-07T10:06:00Z', '2026-09-10', true,
  '2026-09-07T10:06:00Z'
);
update public.fridge_items
set quantity = 500
where id = '11111111-2222-4111-8111-111111111111';
select throws_ok(
  format(
    $$ select public.merge_undo_fridge_item_open(
      '22222222-3333-4222-8222-222222222222',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      %L, '2026-09-07T10:07:00Z', '[Undone] Öffnung rückgängig gemacht'
    ) $$,
    :'household_id'
  ),
  'P0001', 'Der Bestand wurde zwischenzeitlich veraendert',
  'ein veraendertes geoeffnetes Los blockiert den Merge'
);
select is(
  (select quantity from public.fridge_items where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  4000::bigint,
  'der Konflikt aendert das versiegelte Los nicht'
);

insert into public.transactions (
  id, household_id, fridge_item_id, actor, type, quantity, location_id, created_at
)
values (
  '66666666-7777-4666-8666-666666666666', :'household_id',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
  'in', 1000, :'location_id', '2026-09-07T09:00:00Z'
);
select throws_ok(
  format(
    $$ select public.merge_undo_fridge_item_open(
      '44444444-5555-4444-8444-444444444444', '66666666-7777-4666-8666-666666666666',
      %L, '2026-09-07T10:08:00Z', '[Undone]'
    ) $$,
    :'household_id'
  ),
  'P0001', 'Ursprungsbuchung ist unvollstaendig oder kein umkehrbarer Split',
  'eine Nicht-Split-Buchung kann nicht gemergt werden'
);

-- Offline-Move des geoeffneten Loses nach dem Split: sameSplitIdentity (Client)
-- lehnt einen solchen Merge ab, weil der Standort nicht mehr uebereinstimmt.
-- Die RPC muss dieselbe Losidentitaet pruefen statt den Standortwechsel beim
-- Merge stillschweigend zu verwerfen (fam-lem.22).
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.fridge_items (
  id, household_id, location_id, name, quantity, unit, added_by, expiry_date, expiry_user_set
)
values (
  '77777777-8888-4777-8777-777777777777', :'household_id', :'location_id',
  'Standortwechsel-Milch', 5000, 'piece', '11111111-1111-1111-1111-111111111111', '2026-12-31', true
);
select public.split_fridge_item_open(
  '88888888-9999-4888-8888-888888888888',
  '77777777-8888-4777-8777-777777777777',
  '99999999-0000-4999-8999-999999999999',
  :'household_id', 5000, 1000, '2026-09-07T10:10:00Z', '2026-09-10', true,
  '2026-09-07T10:10:00Z'
);
select id as freezer_location_id
from public.storage_locations
where household_id = :'household_id' and kind = 'freezer'
limit 1 \gset
update public.fridge_items
set location_id = :'freezer_location_id'
where id = '99999999-0000-4999-8999-999999999999';
select throws_ok(
  format(
    $$ select public.merge_undo_fridge_item_open(
      'aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa',
      '88888888-9999-4888-8888-888888888888',
      %L, '2026-09-07T10:11:00Z', '[Undone] Öffnung rückgängig gemacht'
    ) $$,
    :'household_id'
  ),
  'P0001', 'Der Bestand wurde zwischenzeitlich veraendert',
  'ein zwischenzeitlicher Standortwechsel des geoeffneten Loses blockiert den Merge'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  format(
    $$ select public.merge_undo_fridge_item_open(
      '55555555-6666-4555-8555-555555555555', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      %L, '2026-09-07T10:09:00Z', '[Undone] Öffnung rückgängig gemacht'
    ) $$,
    :'household_id'
  ),
  'P0001', null,
  'ein Nichtmitglied kann nicht mergen'
);

select * from finish();
rollback;
