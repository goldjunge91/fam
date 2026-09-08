-- Manuelle Mengenkorrekturen vergleichen den geladenen mit dem aktuellen Bestand.

begin;
\ir helpers.sql

select plan(12);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.as_postgres();
select ok(
  has_function_privilege(
    'authenticated',
    'public.correct_fridge_item_quantity(uuid, uuid, uuid, uuid, bigint, bigint, timestamptz)',
    'execute'
  ),
  'authenticated darf Mengen atomar korrigieren'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.correct_fridge_item_quantity(uuid, uuid, uuid, uuid, bigint, bigint, timestamptz)',
    'execute'
  ),
  'anon darf Mengen nicht korrigieren'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Mengenkorrektur-Test') as household_id \gset
select id as location_id
from public.storage_locations
where household_id = :'household_id' and kind = 'fridge'
limit 1 \gset

insert into public.fridge_items (
  id, household_id, location_id, name, quantity, unit, added_by
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', :'household_id', :'location_id',
  'Korrektur-Milch', 5000, 'piece', '11111111-1111-1111-1111-111111111111'
);

select public.correct_fridge_item_quantity(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id', 5000, 3000, '2026-09-07T10:00:00Z'
) as corrected_id \gset

select is(
  :'corrected_id'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'der RPC gibt die Bestands-ID zurueck'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  3000::bigint,
  'die erwartete Menge wird auf den neuen Wert korrigiert'
);
select set_eq(
  $$ select type, quantity, notes
     from public.transactions
     where operation_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  $$ values ('out', 2000::bigint, '[Manual correction]') $$,
  'die Korrektur schreibt genau die Differenz ins Ledger'
);

select public.correct_fridge_item_quantity(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id', 5000, 3000, '2026-09-07T10:00:00Z'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  3000::bigint,
  'ein Retry bleibt idempotent'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'ein Retry dupliziert das Ledger nicht'
);

select throws_ok(
  format(
    $$ select public.correct_fridge_item_quantity(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      %L, 5000, 4000, '2026-09-07T10:01:00Z'
    ) $$,
    :'household_id'
  ),
  'P0001', 'Bestandsmenge wurde zwischenzeitlich geaendert',
  'eine veraltete Korrektur wird als Konflikt abgelehnt'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  3000::bigint,
  'der Konflikt ueberschreibt die aktuelle Menge nicht'
);

-- Ueberpraezise Mengen sind seit der Integer-Tausendstel-Umstellung (fam-lem.30)
-- gar nicht mehr als bigint-Parameter darstellbar; die Grenze liegt jetzt an
-- src/lib/inventory-quantity.ts (contract.md Abschnitt 3), nicht mehr im RPC.
-- Der RPC muss weiterhin identische erwartete/neue Mengen zurueckweisen.
select throws_ok(
  format(
    $$ select public.correct_fridge_item_quantity(
      '12121212-1212-4121-8121-121212121212',
      '13131313-1313-4131-8131-131313131313',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      %L, 3000, 3000, '2026-09-07T10:02:00Z'
    ) $$,
    :'household_id'
  ),
  'P0001', 'Mengenkorrektur braucht zwei unterschiedliche, nicht negative Mengen',
  'identische erwartete und neue Menge wird abgelehnt'
);
select is(
  (select count(*)::int from public.transactions
   where operation_id = '12121212-1212-4121-8121-121212121212'),
  0,
  'eine abgelehnte Korrektur schreibt kein Ledger'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  format(
    $$ select public.correct_fridge_item_quantity(
      '14141414-1414-4141-8141-141414141414',
      '15151515-1515-4151-8151-151515151515',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      %L, 3000, 2000, '2026-09-07T10:03:00Z'
    ) $$,
    :'household_id'
  ),
  'P0001', null,
  'ein Nichtmitglied kann keine Menge korrigieren'
);

select * from finish();
rollback;
