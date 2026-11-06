-- Receipt authority: strukturierte Receipts und Positionen.

begin;
\ir helpers.sql

select plan(49);

select has_table('public', 'purchase_receipts', 'Receipts haben eine eigene Tabelle');
select has_table('public', 'purchase_receipt_items', 'Receipt-Positionen haben eine eigene Tabelle');
select has_column('public', 'purchase_receipts', 'deleted_at', 'Receipts tragen Tombstones');
select has_column('public', 'purchase_receipt_items', 'deleted_at', 'Receipt-Positionen tragen Tombstones');
select ok(
  (select count(*)::int
   from pg_attribute
   where attrelid in (
       'public.purchase_receipts'::regclass,
       'public.receipt_assets'::regclass
     )
     and attname = 'created_by'
     and not attisdropped
     and not attnotnull) = 2,
  'Bon und Bildindex behalten die Autorenschaft optional'
);
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
select throws_ok(
  format(
    $$ insert into public.purchase_receipts (id, household_id, currency, created_by)
       values ('19191919-1919-4191-8191-191919191919', %L, 'EUR', null) $$,
    :'household_id'
  ),
  '42501',
  null,
  'ein neuer Bon braucht weiterhin den eigenen Ersteller'
);
select throws_ok(
  $$ update public.purchase_receipts
     set created_by = null
     where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501',
  null,
  'ein authentifiziertes Mitglied kann die Bon-Autorenschaft nicht umschreiben'
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

-- --------------------------- Konto loeschen, gemeinsame Belege erhalten
select tests.as_postgres();
select tests.create_user('44444444-4444-4444-8444-444444444444', 'hannah@example.com');
select tests.create_user('55555555-5555-4555-8555-555555555555', 'maria@example.com');
select tests.create_user('66666666-6666-4666-8666-666666666666', 'noah@example.com');

select tests.authenticate_as('44444444-4444-4444-8444-444444444444');
select public.create_household('Bon-Autoren-Loeschtest') as deletion_household_id \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values
  (:'deletion_household_id', '55555555-5555-4555-8555-555555555555', 'member'),
  (:'deletion_household_id', '66666666-6666-4666-8666-666666666666', 'admin');

select tests.authenticate_as('44444444-4444-4444-8444-444444444444');
insert into public.purchase_receipts (id, household_id, currency, created_by)
values (
  '42424242-4242-4242-8424-424242424242',
  :'deletion_household_id',
  'EUR',
  '44444444-4444-4444-8444-444444444444'
);
insert into public.purchase_receipt_items (id, receipt_id, household_id, position, name)
values (
  '43434343-4343-4343-8343-434343434343',
  '42424242-4242-4242-8424-424242424242',
  :'deletion_household_id',
  0,
  'Milch Hannah'
);
insert into public.receipt_assets (
  id, receipt_id, household_id, storage_path, mime_type, byte_size, sort_order, created_by
)
values (
  '44444444-4444-4444-8444-444444444445',
  '42424242-4242-4242-8424-424242424242',
  :'deletion_household_id',
  :'deletion_household_id' || '/42424242-4242-4242-8424-424242424242/44444444-4444-4444-8444-444444444445.jpg',
  'image/jpeg',
  1024,
  0,
  '44444444-4444-4444-8444-444444444444'
);

select lives_ok(
  $$ select public.prepare_account_deletion() $$,
  'die Vorbereitung der Loeschung ist unter Hannahs JWT erfolgreich'
);
select tests.as_postgres();
select lives_ok(
  $$ delete from auth.users where id = '44444444-4444-4444-8444-444444444444' $$,
  'die Auth-Admin-Loeschung von Hannah wird nicht durch geteilte Belege blockiert'
);
select is(
  (select jsonb_build_object(
    'auth_users', (select count(*)::int from auth.users where id = '44444444-4444-4444-8444-444444444444'),
    'receipts', (select count(*)::int from public.purchase_receipts where id = '42424242-4242-4242-8424-424242424242'),
    'receipt_author_removed', coalesce((select created_by is null from public.purchase_receipts where id = '42424242-4242-4242-8424-424242424242'), false),
    'items', (select count(*)::int from public.purchase_receipt_items where receipt_id = '42424242-4242-4242-8424-424242424242'),
    'assets', (select count(*)::int from public.receipt_assets where receipt_id = '42424242-4242-4242-8424-424242424242'),
    'asset_author_removed', coalesce((select created_by is null from public.receipt_assets where receipt_id = '42424242-4242-4242-8424-424242424242'), false)
  )),
  jsonb_build_object(
    'auth_users', 0,
    'receipts', 1,
    'receipt_author_removed', true,
    'items', 1,
    'assets', 1,
    'asset_author_removed', true
  ),
  'Bon, Position und Bild bleiben nach Hannahs Loeschung erhalten; beide Erstellerverweise sind entfernt'
);

-- Maria verlaesst denselben geteilten Haushalt vor der Account-Loeschung.
select tests.authenticate_as('55555555-5555-4555-8555-555555555555');
insert into public.purchase_receipts (id, household_id, currency, created_by)
values (
  '45454545-4545-4545-8545-454545454545',
  :'deletion_household_id',
  'EUR',
  '55555555-5555-4555-8555-555555555555'
);
insert into public.purchase_receipt_items (id, receipt_id, household_id, position, name)
values (
  '46464646-4646-4646-8646-464646464646',
  '45454545-4545-4545-8545-454545454545',
  :'deletion_household_id',
  0,
  'Milch Maria'
);
insert into public.receipt_assets (
  id, receipt_id, household_id, storage_path, mime_type, byte_size, sort_order, created_by
)
values (
  '47474747-4747-4747-8747-474747474747',
  '45454545-4545-4545-8545-454545454545',
  :'deletion_household_id',
  :'deletion_household_id' || '/45454545-4545-4545-8545-454545454545/47474747-4747-4747-8747-474747474747.jpg',
  'image/jpeg',
  2048,
  0,
  '55555555-5555-4555-8555-555555555555'
);
select lives_ok(
  format(
    $$ delete from public.household_members where household_id = %L and user_id = %L $$,
    :'deletion_household_id',
    '55555555-5555-4555-8555-555555555555'
  ),
  'Maria kann den Haushalt vor dem Entfernen ihres Accounts verlassen'
);
select lives_ok(
  $$ select public.prepare_account_deletion() $$,
  'die Vorbereitung der Loeschung laeuft auch nach dem Haushaltsaustritt durch'
);
select tests.as_postgres();
select lives_ok(
  $$ delete from auth.users where id = '55555555-5555-4555-8555-555555555555' $$,
  'die Auth-Admin-Loeschung von Maria wird nicht durch den verlassenen Haushalt blockiert'
);
select is(
  (select jsonb_build_object(
    'auth_users', (select count(*)::int from auth.users where id = '55555555-5555-4555-8555-555555555555'),
    'receipts', (select count(*)::int from public.purchase_receipts where id = '45454545-4545-4545-8545-454545454545'),
    'receipt_author_removed', coalesce((select created_by is null from public.purchase_receipts where id = '45454545-4545-4545-8545-454545454545'), false),
    'items', (select count(*)::int from public.purchase_receipt_items where receipt_id = '45454545-4545-4545-8545-454545454545'),
    'assets', (select count(*)::int from public.receipt_assets where receipt_id = '45454545-4545-4545-8545-454545454545'),
    'asset_author_removed', coalesce((select created_by is null from public.receipt_assets where receipt_id = '45454545-4545-4545-8545-454545454545'), false)
  )),
  jsonb_build_object(
    'auth_users', 0,
    'receipts', 1,
    'receipt_author_removed', true,
    'items', 1,
    'assets', 1,
    'asset_author_removed', true
  ),
  'Bon, Position und Bild bleiben nach Marias Haushaltsaustritt erhalten; beide Erstellerverweise sind entfernt'
);

select * from finish();
rollback;
