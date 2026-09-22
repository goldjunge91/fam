-- Receipt authority: serverseitiger Asset-Index und privater Storage-Bucket.

begin;
\ir helpers.sql

select plan(29);

select has_table('public', 'receipt_assets', 'Receipt-Assets haben einen serverseitigen Index');
select has_column('public', 'receipt_assets', 'deleted_at', 'Receipt-Assets koennen Tombstones tragen');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.receipt_assets'::regclass),
  'Receipt-Assets haben aktiviertes RLS'
);
select ok(
  exists (select 1 from storage.buckets where id = 'receipt-images'),
  'der Receipt-Bucket ist lokal angelegt'
);
select is(
  (select public::text from storage.buckets where id = 'receipt-images'),
  'false',
  'der Receipt-Bucket ist privat'
);
select is(
  (select file_size_limit from storage.buckets where id = 'receipt-images'),
  5242880::bigint,
  'der Receipt-Bucket begrenzt Bilder auf 5 MiB'
);
select set_eq(
  $$ select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'receipt_images_%' $$,
  $$ values ('receipt_images_select'), ('receipt_images_insert'),
            ('receipt_images_update'), ('receipt_images_delete') $$,
  'der private Receipt-Bucket hat vier getrennte Storage-Policies'
);
select ok(
  (
    select qual
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'receipt_images_select'
  ) like '%storage.foldername%'
  and (
    select qual
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'receipt_images_select'
  ) like '%private.is_household_member%',
  'Storage-Reads pruefen den Haushaltspfad und die Mitgliedschaft'
);
select ok(
  (
    select with_check
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'receipt_images_insert'
  ) like '%storage.foldername%'
  and (
    select with_check
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'receipt_images_insert'
  ) like '%private.is_household_member%',
  'Storage-Inserts pruefen den Haushaltspfad und die Mitgliedschaft'
);
select ok(
  (
    select qual
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'receipt_images_update'
  ) like '%private.is_household_member%'
  and (
    select with_check
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'receipt_images_update'
  ) like '%private.is_household_member%',
  'Storage-Updates haben USING und WITH CHECK fuer denselben Haushalt'
);
select ok(
  (
    select qual
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'receipt_images_delete'
  ) like '%private.is_household_member%',
  'Storage-Deletes pruefen die Haushaltsmitgliedschaft'
);
select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'receipt_images_%'
      and 'public' = any(roles)
  ),
  'kein Receipt-Storage-Objekt wird ueber eine Public-Policy freigegeben'
);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Receipt-Asset-Haushalt') as household_id \gset
insert into public.purchase_receipts (id, household_id, currency, total_cents, created_by)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  :'household_id',
  'EUR',
  1200,
  '11111111-1111-1111-1111-111111111111'
);
insert into public.purchase_receipt_items (id, receipt_id, household_id, position, name, line_total_cents)
values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  :'household_id',
  0,
  'Milch',
  1200
);

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select public.create_household('Fremder Asset-Haushalt') as foreign_household_id \gset
select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'household_id', '22222222-2222-2222-2222-222222222222', 'member');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.receipt_assets (
  id,
  receipt_id,
  household_id,
  storage_path,
  mime_type,
  byte_size,
  sort_order,
  created_by
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    :'household_id',
    :'household_id' || '/dddddddd-dddd-4ddd-8ddd-dddddddddddd/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',
    'image/jpeg',
    1200,
    0,
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    :'household_id',
    :'household_id' || '/dddddddd-dddd-4ddd-8ddd-dddddddddddd/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png',
    'image/png',
    2400,
    1,
    '11111111-1111-1111-1111-111111111111'
  );
select is(
  (select count(*)::int from public.receipt_assets where deleted_at is null),
  2,
  'ein Receipt kann mehrere aktive Assets besitzen'
);

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.receipt_assets),
  2,
  'jedes Haushaltsmitglied sieht alle Asset-Metadaten'
);
update public.receipt_assets
set sort_order = 2
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is(
  (select sort_order from public.receipt_assets where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2,
  'jedes Haushaltsmitglied darf Asset-Metadaten korrigieren'
);
update public.receipt_assets
set deleted_at = now()
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select ok(
  (select deleted_at is not null from public.receipt_assets where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'ein Asset kann unabhaengig soft-geloescht werden'
);
update public.receipt_assets
set deleted_at = null
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select ok(
  (select deleted_at is null from public.receipt_assets where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'ein Asset kann wiederhergestellt werden'
);
delete from public.receipt_assets
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is(
  (select count(*)::int from public.receipt_assets),
  1,
  'jedes Haushaltsmitglied darf ein Asset unabhaengig entfernen'
);
select is(
  (select count(*)::int from public.purchase_receipts),
  1,
  'Asset-Loeschung behaelt den strukturierten Receipt'
);
select is(
  (select count(*)::int from public.purchase_receipt_items),
  1,
  'Asset-Loeschung behaelt die Receipt-Positionen'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::int from public.receipt_assets),
  0,
  'ein Aussenstehender sieht keine fremden Asset-Metadaten'
);
select throws_ok(
  format(
    $$ insert into public.receipt_assets
         (id, receipt_id, household_id, storage_path, mime_type, byte_size, created_by)
       values ('12121212-1212-4121-8121-121212121212', %L, %L,
               %L, 'image/jpeg', 1200, %L) $$,
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    :'household_id',
    '11111111-1111-1111-1111-111111111111/ddd/12121212-1212-4121-8121-121212121212.jpg',
    '33333333-3333-3333-3333-333333333333'
  ),
  '42501', null,
  'ein Aussenstehender kann kein fremdes Asset anlegen'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  format(
    $$ insert into public.receipt_assets
         (id, receipt_id, household_id, storage_path, mime_type, byte_size, created_by)
       values ('13131313-1313-4131-8131-131313131313',
               'dddddddd-dddd-4ddd-8ddd-dddddddddddd', %L, %L,
               'image/jpeg', 1200, '11111111-1111-1111-1111-111111111111') $$,
    :'household_id',
    :'household_id' || '/dddddddd-dddd-4ddd-8ddd-dddddddddddd/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'
  ),
  '23514', null,
  'ein Asset-Pfad muss seine eigene Asset-ID enthalten'
);
select throws_ok(
  format(
    $$ insert into public.receipt_assets
         (id, receipt_id, household_id, storage_path, mime_type, byte_size, created_by)
       values ('14141414-1414-4141-8141-141414141414',
               'dddddddd-dddd-4ddd-8ddd-dddddddddddd', %L, %L,
               'image/gif', 1200, '11111111-1111-1111-1111-111111111111') $$,
    :'household_id',
    :'household_id' || '/dddddddd-dddd-4ddd-8ddd-dddddddddddd/14141414-1414-4141-8141-141414141414.gif'
  ),
  '23514', null,
  'nur erlaubte Bild-MIME-Typen werden akzeptiert'
);
select throws_ok(
  format(
    $$ insert into public.receipt_assets
         (id, receipt_id, household_id, storage_path, mime_type, byte_size, created_by)
       values ('15151515-1515-4151-8151-151515151515',
               'dddddddd-dddd-4ddd-8ddd-dddddddddddd', %L, %L,
               'image/jpeg', 5242881, '11111111-1111-1111-1111-111111111111') $$,
    :'household_id',
    :'household_id' || '/dddddddd-dddd-4ddd-8ddd-dddddddddddd/15151515-1515-4151-8151-151515151515.jpg'
  ),
  '23514', null,
  'Asset-Groesse darf das Bucket-Limit nicht ueberschreiten'
);

select tests.as_postgres();
select throws_ok(
  format(
    $$ insert into public.receipt_assets
         (id, receipt_id, household_id, storage_path, mime_type, byte_size, sort_order, created_by)
       values ('16161616-1616-4161-8161-161616161616', %L, %L,
               %L, 'image/jpeg', 1200, 7, %L) $$,
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    :'foreign_household_id',
    :'foreign_household_id' || '/dddddddd-dddd-4ddd-8ddd-dddddddddddd/16161616-1616-4161-8161-161616161616.jpg',
    '11111111-1111-1111-1111-111111111111'
  ),
  '23503', null,
  'ein Asset kann nicht den Haushalt der Receipt wechseln'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
delete from public.receipt_assets
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select count(*)::int from public.receipt_assets),
  0,
  'das letzte Asset kann entfernt werden, ohne den Receipt zu loeschen'
);
select is(
  (select count(*)::int from public.purchase_receipts),
  1,
  'nach Entfernung aller Bilder bleibt der Receipt erhalten'
);
select is(
  (select count(*)::int from public.purchase_receipt_items),
  1,
  'nach Entfernung aller Bilder bleiben die Positionen erhalten'
);

select * from finish();
rollback;
