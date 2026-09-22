-- Receipt authority: strukturierte Receipts und Positionen.

begin;
\ir helpers.sql

select plan(39);

select has_table('public', 'purchase_receipts', 'Receipts haben eine eigene kanonische Tabelle');
select has_table('public', 'purchase_receipt_items', 'Receipt-Positionen haben eine eigene kanonische Tabelle');
select has_column('public', 'purchase_receipts', 'deleted_at', 'Receipts tragen Tombstones');
select has_column('public', 'purchase_receipt_items', 'deleted_at', 'Receipt-Positionen tragen Tombstones');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.purchase_receipts'::regclass),
  'Receipts haben aktiviertes RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.purchase_receipt_items'::regclass),
  'Receipt-Positionen haben aktiviertes RLS'
);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Receipt-Haushalt') as household_id \gset
select id as store_id
from public.stores
where household_id = :'household_id' and name = 'REWE'
limit 1 \gset

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select public.create_household('Fremder Receipt-Haushalt') as foreign_household_id \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'household_id', '22222222-2222-2222-2222-222222222222', 'member');
select id as foreign_store_id
from public.stores
where household_id = :'foreign_household_id' and name = 'REWE'
limit 1 \gset

select ok(
  has_table_privilege('authenticated', 'public.purchase_receipts', 'select,insert,update'),
  'authenticated darf Receipts lesen, anlegen und korrigieren'
);
select ok(
  has_table_privilege('authenticated', 'public.purchase_receipt_items', 'select,insert,update'),
  'authenticated darf Receipt-Positionen lesen, anlegen und korrigieren'
);
select ok(
  not has_table_privilege('authenticated', 'public.purchase_receipts', 'delete'),
  'authenticated kann Receipts nur per Tombstone entfernen'
);
select ok(
  not has_table_privilege('authenticated', 'public.purchase_receipt_items', 'delete'),
  'authenticated kann Receipt-Positionen nur per Tombstone entfernen'
);
select ok(
  not has_table_privilege('anon', 'public.purchase_receipts', 'select'),
  'anon hat keinen Tabellenzugriff auf Receipts'
);
select ok(
  not has_table_privilege('anon', 'public.purchase_receipt_items', 'insert'),
  'anon hat keinen Tabellenzugriff auf Receipt-Positionen'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.purchase_receipts (
  id,
  household_id,
  store_id,
  purchase_date,
  currency,
  total_cents,
  processing_status,
  created_by
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id',
  :'store_id',
  '2026-09-20',
  'EUR',
  1234,
  'draft',
  '11111111-1111-1111-1111-111111111111'
);

select is(
  (select currency from public.purchase_receipts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'EUR',
  'ein Receipt speichert ausschliesslich EUR'
);
select is(
  (select total_cents from public.purchase_receipts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1234::bigint,
  'der Receipt-Gesamtbetrag wird als Centzahl gespeichert'
);
select is(
  (select created_by from public.purchase_receipts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'created_by wird auf das authentifizierte Mitglied gebunden'
);

insert into public.purchase_receipt_items (
  id,
  receipt_id,
  household_id,
  position,
  name,
  quantity,
  unit,
  line_total_cents,
  review_status
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'household_id',
  0,
  'Milch',
  2,
  'package',
  500,
  'needs_review'
);

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.purchase_receipts),
  1,
  'ein anderes Haushaltsmitglied sieht den Receipt'
);
update public.purchase_receipts
set total_cents = 1300
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select total_cents from public.purchase_receipts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1300::bigint,
  'ein anderes Haushaltsmitglied darf den Gesamtbetrag korrigieren'
);
select is(
  (select count(*)::int from public.purchase_receipt_items),
  1,
  'ein anderes Haushaltsmitglied sieht die Receipt-Position'
);
update public.purchase_receipt_items
set name = 'Vollmilch'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is(
  (select name from public.purchase_receipt_items where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'Vollmilch',
  'ein anderes Haushaltsmitglied darf eine Position korrigieren'
);
select isnt(
  (select total_cents from public.purchase_receipts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  (select coalesce(sum(line_total_cents), 0)::bigint from public.purchase_receipt_items),
  'der finale Gesamtbetrag darf von der Item-Summe abweichen'
);

update public.purchase_receipts
set deleted_at = now()
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select ok(
  (select deleted_at is not null from public.purchase_receipts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'ein Receipt wird per deleted_at soft-geloescht'
);
update public.purchase_receipts
set deleted_at = null
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select ok(
  (select deleted_at is null from public.purchase_receipts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'ein Receipt kann von einem Mitglied wiederhergestellt werden'
);
update public.purchase_receipt_items
set deleted_at = now()
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select ok(
  (select deleted_at is not null from public.purchase_receipt_items where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'eine Receipt-Position wird per deleted_at soft-geloescht'
);
update public.purchase_receipt_items
set deleted_at = null
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select ok(
  (select deleted_at is null from public.purchase_receipt_items where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'eine Receipt-Position kann wiederhergestellt werden'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  format(
    $$ insert into public.purchase_receipts (id, household_id, currency, created_by)
       values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', %L, 'EUR',
               '22222222-2222-2222-2222-222222222222') $$,
    :'household_id'
  ),
  '42501',
  null,
  'created_by kann nicht auf ein anderes Mitglied gesetzt werden'
);
select throws_ok(
  $$ update public.purchase_receipts
     set processing_status = 'confirmed',
         confirmed_by = '22222222-2222-2222-2222-222222222222',
         confirmed_at = now()
     where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501',
  null,
  'confirmed_by kann nicht auf ein anderes Mitglied gesetzt werden'
);
update public.purchase_receipts
set processing_status = 'confirmed',
    confirmed_by = '11111111-1111-1111-1111-111111111111',
    confirmed_at = now()
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select processing_status from public.purchase_receipts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'confirmed',
  'ein Mitglied kann einen Receipt bestaetigen'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::int from public.purchase_receipts),
  0,
  'ein Aussenstehender sieht keine fremden Receipts'
);
select is(
  (select count(*)::int from public.purchase_receipt_items),
  0,
  'ein Aussenstehender sieht keine fremden Receipt-Positionen'
);
select throws_ok(
  format(
    $$ insert into public.purchase_receipts (id, household_id, currency, created_by)
       values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', %L, 'EUR',
               '33333333-3333-3333-3333-333333333333') $$,
    :'household_id'
  ),
  '42501',
  null,
  'ein Aussenstehender kann keinen fremden Receipt anlegen'
);

select tests.as_postgres();
select throws_ok(
  format(
    $$ insert into public.purchase_receipts (id, household_id, store_id, currency, created_by)
       values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', %L, %L, 'EUR', %L) $$,
    :'household_id',
    :'foreign_store_id',
    '11111111-1111-1111-1111-111111111111'
  ),
  '23514',
  null,
  'ein Receipt kann keinen Markt eines anderen Haushalts referenzieren'
);
update public.stores set deleted_at = now() where id = :'foreign_store_id';
select throws_ok(
  format(
    $$ insert into public.purchase_receipts (id, household_id, store_id, currency, created_by)
       values ('ffffffff-ffff-4fff-8fff-ffffffffffff', %L, %L, 'EUR', %L) $$,
    :'household_id',
    :'foreign_store_id',
    '11111111-1111-1111-1111-111111111111'
  ),
  '23514',
  null,
  'ein Receipt kann keinen geloeschten Markt referenzieren'
);
select throws_ok(
  format(
    $$ insert into public.purchase_receipt_items
         (id, receipt_id, household_id, position, name)
       values ('12121212-1212-4121-8121-121212121212',
               'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', %L, 1, 'Fremde Zuordnung') $$,
    :'foreign_household_id'
  ),
  '23503',
  null,
  'eine Receipt-Position kann nicht den Haushalt der Receipt wechseln'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  format(
    $$ insert into public.purchase_receipts (id, household_id, currency, total_cents, created_by)
       values ('13131313-1313-4131-8131-131313131313', %L, 'USD', 100,
               '11111111-1111-1111-1111-111111111111') $$,
    :'household_id'
  ),
  '23514', null,
  'eine andere Waehrung als EUR wird abgelehnt'
);
select throws_ok(
  format(
    $$ insert into public.purchase_receipts (id, household_id, currency, total_cents, created_by)
       values ('14141414-1414-4141-8141-141414141414', %L, 'EUR', -1,
               '11111111-1111-1111-1111-111111111111') $$,
    :'household_id'
  ),
  '23514', null,
  'negative Gesamt-Cents werden abgelehnt'
);
select throws_ok(
  format(
    $$ insert into public.purchase_receipt_items
         (id, receipt_id, household_id, position, name, line_total_cents)
       values ('15151515-1515-4151-8151-151515151515',
               'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', %L, 1, 'Negativ', -1) $$,
    :'household_id'
  ),
  '23514', null,
  'negative Positions-Cents werden abgelehnt'
);
select throws_ok(
  format(
    $$ insert into public.purchase_receipt_items
         (id, receipt_id, household_id, position, name, package_size)
       values ('16161616-1616-4161-8161-161616161616',
               'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', %L, 1, 'Ohne Einheit', 500) $$,
    :'household_id'
  ),
  '23514', null,
  'eine Packungsmenge braucht eine Packungseinheit'
);
select throws_ok(
  format(
    $$ insert into public.purchase_receipt_items
         (id, receipt_id, household_id, position, name, review_status)
       values ('17171717-1717-4171-8171-171717171717',
               'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', %L, 1, 'Statusfehler', 'draft') $$,
    :'household_id'
  ),
  '23514', null,
  'eine Receipt-Position akzeptiert nur die Review-Statuswerte'
);
select throws_ok(
  format(
    $$ insert into public.purchase_receipt_items
         (id, receipt_id, household_id, position, name)
       values ('18181818-1818-4181-8181-181818181818',
               'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', %L, -1, 'Negative Position') $$,
    :'household_id'
  ),
  '23514', null,
  'negative Receipt-Positionen werden abgelehnt'
);

select * from finish();
rollback;
