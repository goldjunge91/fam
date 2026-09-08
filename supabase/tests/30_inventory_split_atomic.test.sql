-- Ein Split-Öffnen vergleicht die geladene mit der aktuellen Ausgangsmenge,
-- bevor Rest-Los, geöffnetes Los und Ledger gemeinsam geschrieben werden.

begin;
\ir helpers.sql

select plan(14);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.as_postgres();
select ok(
  has_function_privilege(
    'authenticated',
    'public.split_fridge_item_open(uuid, uuid, uuid, uuid, numeric, numeric, timestamptz, date, boolean, timestamptz)',
    'execute'
  ),
  'authenticated darf atomar splitten'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.split_fridge_item_open(uuid, uuid, uuid, uuid, numeric, numeric, timestamptz, date, boolean, timestamptz)',
    'execute'
  ),
  'anon darf nicht splitten'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Split-Test') as household_id \gset
select id as location_id
from public.storage_locations
where household_id = :'household_id' and kind = 'fridge'
limit 1 \gset

insert into public.fridge_items (
  id, household_id, location_id, name, quantity, unit, added_by, expiry_date, expiry_user_set
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', :'household_id', :'location_id',
  'Split-Milch', 5, 'piece', '11111111-1111-1111-1111-111111111111', '2026-12-31', true
);

select public.split_fridge_item_open(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  :'household_id', 5, 1, '2026-09-07T10:00:00Z', '2026-09-10', true,
  '2026-09-07T10:00:00Z'
) as opened_id \gset

select is(
  :'opened_id'::uuid,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'der RPC gibt die ID des geoeffneten Loses zurueck'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  4::numeric,
  'das Rest-Los verliert genau die geoeffnete Menge'
);
select is(
  (select (quantity, opened_at is not null, deleted_at is null)
   from public.fridge_items where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  (1::numeric, true, true),
  'das neue Los traegt die geoeffnete Menge und ist offen'
);
select set_eq(
  $$ select type, quantity, origin_item_id, origin_quantity
     from public.transactions where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  $$ values (
    'open', 1::numeric, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 5::numeric
  ) $$,
  'die Ledgerzeile traegt Split-Menge und Ursprungsmenge'
);

-- Retry mit derselben Ledger-ID bleibt idempotent statt erneut zu schreiben.
select public.split_fridge_item_open(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  :'household_id', 5, 1, '2026-09-07T10:00:00Z', '2026-09-10', true,
  '2026-09-07T10:00:00Z'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  4::numeric,
  'ein Retry bleibt idempotent'
);
select is(
  (select count(*)::int from public.transactions where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'ein Retry dupliziert die Ledgerzeile nicht'
);

-- Zwischenzeitlicher Verbrauch (Rest-Los jetzt bei 2 statt der erwarteten 5)
-- darf durch einen spaeten, auf dem alten Stand geplanten Split nicht
-- ueberschrieben werden.
update public.fridge_items set quantity = 2 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select throws_ok(
  format(
    $$ select public.split_fridge_item_open(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      %L, 5, 1, '2026-09-07T10:01:00Z', '2026-09-10', true, '2026-09-07T10:01:00Z'
    ) $$,
    :'household_id'
  ),
  'P0001', 'Bestandsmenge wurde zwischenzeitlich geaendert',
  'ein veralteter Split wird als Konflikt abgelehnt'
);
select is(
  (select quantity from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  2::numeric,
  'der Konflikt ueberschreibt den zwischenzeitlichen Verbrauch nicht'
);
select is(
  (select count(*)::int from public.fridge_items where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  0,
  'der Konflikt legt kein geoeffnetes Los an'
);

-- Öffnen der kompletten Restmenge loescht das Quell-Los weich statt es bei 0 zu belassen.
select public.split_fridge_item_open(
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-2222-4111-8111-111111111111',
  :'household_id', 2, 2, '2026-09-07T10:02:00Z', '2026-09-10', true, '2026-09-07T10:02:00Z'
);
select is(
  (select deleted_at is not null from public.fridge_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  true,
  'ein vollstaendig geoeffnetes Rest-Los wird weich geloescht'
);

select throws_ok(
  format(
    $$ select public.split_fridge_item_open(
      '22222222-3333-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '33333333-4444-4333-8333-333333333333',
      %L, 3, 3.0001, '2026-09-07T10:03:00Z', '2026-09-10', true, '2026-09-07T10:03:00Z'
    ) $$,
    :'household_id'
  ),
  'P0001', 'Mengen duerfen hoechstens drei Nachkommastellen haben',
  'mehr als drei Nachkommastellen werden abgelehnt'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  format(
    $$ select public.split_fridge_item_open(
      '44444444-5555-4444-8444-444444444444',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '55555555-6666-4555-8555-555555555555',
      %L, 2, 1, '2026-09-07T10:04:00Z', '2026-09-10', true, '2026-09-07T10:04:00Z'
    ) $$,
    :'household_id'
  ),
  'P0001', null,
  'ein Nichtmitglied kann nicht splitten'
);

select * from finish();
rollback;
