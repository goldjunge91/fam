-- RLS, Constraints und Berechtigungen fuer das append-only Inventory-Ledger.

begin;
\ir helpers.sql

select plan(16);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Lifecycle-Haushalt') as household_id \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'household_id', '22222222-2222-2222-2222-222222222222', 'member');

-- -------------------------------------------------------------- Privilegien
select tests.as_postgres();
select ok(
  has_table_privilege('authenticated', 'public.transactions', 'select,insert'),
  'authenticated hat genau die benoetigten Ledger-Rechte'
);
select ok(
  not has_table_privilege('authenticated', 'public.transactions', 'update'),
  'authenticated kann Ledger-Zeilen nicht aktualisieren'
);
select ok(
  not has_table_privilege('authenticated', 'public.transactions', 'delete'),
  'authenticated kann Ledger-Zeilen nicht loeschen'
);
select ok(
  has_table_privilege('service_role', 'public.transactions', 'select,insert'),
  'service_role kann Ledger-Zeilen synchronisieren'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.transactions (
  id, household_id, type, quantity, previous_expiry_date, notes
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', :'household_id', 'open', 1,
  '2026-12-31', 'Senf geöffnet'
);
select is(
  (select count(*)::int from public.transactions where household_id = :'household_id'),
  1,
  'ein Haushaltsmitglied sieht den eigenen Ledger-Eintrag'
);

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.transactions where household_id = :'household_id'),
  1,
  'ein anderes Haushaltsmitglied sieht den gemeinsamen Ledger'
);
insert into public.transactions (id, household_id, type, quantity)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', :'household_id', 'out', 1);
select is(
  (select count(*)::int from public.transactions where household_id = :'household_id'),
  2,
  'ein anderes Haushaltsmitglied darf eine Bewegung anfügen'
);
select throws_ok(
  $$ update public.transactions set notes = 'manipuliert' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501', null,
  'ein Haushaltsmitglied kann Ledger-Einträge nicht ändern'
);
select throws_ok(
  $$ delete from public.transactions where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  '42501', null,
  'ein Haushaltsmitglied kann Ledger-Einträge nicht löschen'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::int from public.transactions where household_id = :'household_id'),
  0,
  'ein Nichtmitglied sieht den Ledger nicht'
);
select throws_ok(
  format(
    $$ insert into public.transactions (id, household_id, type, quantity)
       values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', %L, 'in', 1) $$,
    :'household_id'
  ),
  '42501', null,
  'ein Nichtmitglied kann keine Bewegung einschleusen'
);

-- --------------------------------------------------------------- Constraints
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  format(
    $$ insert into public.transactions (id, household_id, type, quantity)
       values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', %L, 'waste', 1) $$,
    :'household_id'
  ),
  '23514', null,
  'waste braucht einen Grund'
);
select throws_ok(
  format(
    $$ insert into public.transactions (id, household_id, type, quantity, reason)
       values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', %L, 'out', 1, 'expired') $$,
    :'household_id'
  ),
  '23514', null,
  'nicht-waste darf keinen Verschwendungsgrund tragen'
);
select throws_ok(
  format(
    $$ insert into public.transactions (id, household_id, type, quantity, previous_expiry_date)
       values ('ffffffff-ffff-4fff-8fff-ffffffffffff', %L, 'out', 1, '2026-12-31') $$,
    :'household_id'
  ),
  '23514', null,
  'previous_expiry_date ist auf Öffnungen beschränkt'
);
select throws_ok(
  format(
    $$ insert into public.transactions (id, household_id, type, quantity)
       values ('99999999-9999-4999-8999-999999999999', %L, 'in', 0) $$,
    :'household_id'
  ),
  '23514', null,
  'eine Bewegung braucht eine positive Menge'
);
select throws_ok(
  format(
    $$ insert into public.transactions (id, household_id, type, quantity, notes)
       values ('88888888-8888-4888-8888-888888888888', %L, 'in', 1, repeat('x', 501)) $$,
    :'household_id'
  ),
  '23514', null,
  'Notizen sind auf 500 Zeichen begrenzt'
);

select * from finish();
rollback;
