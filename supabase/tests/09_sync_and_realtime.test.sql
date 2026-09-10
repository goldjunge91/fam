-- Sync-Metadaten und Realtime-Publication (#42, #44, #43).
--
-- Diese Suite prueft Voraussetzungen der Offline-Engine (Epic 2). Faellt eine
-- davon weg, merkt man es sonst erst daran, dass Daten verschwinden oder
-- wieder auftauchen — Wochen spaeter und schwer zurueckzuverfolgen.

begin;
\ir helpers.sql

select plan(47);

-- ----------------------------------------------------- Inventory-Grenzen
-- Die Serverbasis speichert Mengen als physische Dezimalwerte. Die App darf
-- vor dem Persistieren keine implizite Skalierung mehr einschleusen.
select is(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'fridge_items' and column_name = 'quantity'),
  'numeric',
  'fridge_items.quantity ist numeric'
);
select is(
  (select format('%s,%s', numeric_precision, numeric_scale)
   from information_schema.columns
   where table_schema = 'public' and table_name = 'fridge_items' and column_name = 'quantity'),
  '10,1',
  'fridge_items.quantity hat numeric(10,1)'
);
select is(
  (select format('%s,%s', numeric_precision, numeric_scale)
   from information_schema.columns
   where table_schema = 'public' and table_name = 'fridge_items' and column_name = 'package_size'),
  '10,1',
  'fridge_items.package_size hat numeric(10,1)'
);
select is(
  (select format('%s,%s', numeric_precision, numeric_scale)
   from information_schema.columns
   where table_schema = 'public' and table_name = 'transactions' and column_name = 'quantity'),
  '10,1',
  'transactions.quantity hat numeric(10,1)'
);
select has_column('public', 'transactions', 'unit', 'transactions führt die Mengenbasis je Ledgerzeile');
select is(
  (select is_nullable from information_schema.columns
   where table_schema = 'public' and table_name = 'fridge_items' and column_name = 'location_id'),
  'NO',
  'fridge_items.location_id ist verpflichtend'
);
select hasnt_column('public', 'transactions', 'undone', 'transactions hat keinen Legacy-undone-Status');
select hasnt_column('public', 'transactions', 'previous_expiry_date', 'transactions hat keine Legacy-Öffnungsmetadaten');
select hasnt_column('public', 'transactions', 'origin_item_id', 'transactions hat keine Legacy-Split-Quelle');
select hasnt_column('public', 'transactions', 'origin_quantity', 'transactions hat keine Legacy-Split-Menge');
select hasnt_column('public', 'transactions', 'sync_sequence', 'transactions hat keine Legacy-Sync-Sequenz');
select is(
  (select is_nullable from information_schema.columns
   where table_schema = 'public' and table_name = 'transactions' and column_name = 'fridge_item_id'),
  'NO',
  'transactions.fridge_item_id ist verpflichtend'
);
select is(
  (select is_nullable from information_schema.columns
   where table_schema = 'public' and table_name = 'transactions' and column_name = 'location_id'),
  'NO',
  'transactions.location_id ist verpflichtend'
);
select is(
  (select is_nullable from information_schema.columns
   where table_schema = 'public' and table_name = 'transactions' and column_name = 'operation_id'),
  'NO',
  'transactions.operation_id ist verpflichtend'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'transactions'
      and indexname = 'transactions_operation_type_idx'
      and indexdef ilike '%unique%'
      and indexdef not ilike '%where%'
  ),
  'transactions hat einen eindeutigen Operation-Typ-Idempotenzindex'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'transactions'
      and indexname = 'transactions_reversal_of_idx'
      and indexdef ilike '%unique%'
  ),
  'transactions verhindert mehr als ein globales Reversal pro Quelle'
);

-- ------------------------------------------------- Sync-Spalten auf allen Tabellen
-- `updated_at` treibt den inkrementellen Pull, `deleted_at` die Tombstones.
-- Ohne beide ist Last-Write-Wins nicht entscheidbar.
select has_column('public', 'fridge_items', 'updated_at', 'fridge_items hat updated_at');
select has_column('public', 'fridge_items', 'deleted_at', 'fridge_items hat deleted_at');
select has_column('public', 'shopping_list_items', 'deleted_at', 'shopping_list_items hat deleted_at');
select has_column('public', 'food_entries', 'deleted_at', 'food_entries hat deleted_at');
select has_column(
  'public',
  'shopping_category_preferences',
  'deleted_at',
  'shopping_category_preferences hat deleted_at'
);

-- storage_locations ist Spiegeltabelle der Offline-Engine (#45). Ohne
-- deleted_at haette ein offline geloeschter Lagerort keinen Tombstone-Pfad und
-- taeuchte beim naechsten Push wieder auf.
select has_column('public', 'storage_locations', 'deleted_at', 'storage_locations hat deleted_at');

-- household_members trug urspruenglich nur joined_at. Ohne updated_at ist ein
-- Rollenwechsel fuer einen "updated_at >"-Pull unsichtbar, und ein entferntes
-- Mitglied behielte lokal Rechte, die serverseitig weg sind.
select has_column('public', 'household_members', 'updated_at', 'household_members hat updated_at');

-- ------------------------------------------------------- updated_at-Automatik
select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset
select id as location_id
  from public.storage_locations
 where household_id = :'hid'
 order by sort_order, created_at
 limit 1 \gset

select tests.as_postgres();
insert into public.fridge_items (id, household_id, location_id, name, quantity, unit, added_by)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'hid',
  :'location_id',
  'Milch',
  1.0,
  'piece',
  '11111111-1111-1111-1111-111111111111'
);

select throws_ok(
  format($$ insert into public.fridge_items
    (id, household_id, location_id, name, quantity, unit)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', %L, %L, 'Grenzwert', 10000000.0, 'piece') $$,
    :'hid', :'location_id'
  ),
  '23514',
  NULL,
  'fridge_items weist Mengen über 9_999_999.9 zurück'
);
select throws_ok(
  format($$ insert into public.fridge_items
    (id, household_id, location_id, name, quantity, unit, package_size)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', %L, %L, 'Ohne Einheit', 1.0, 'piece', 2.0) $$,
    :'hid', :'location_id'
  ),
  '23514',
  NULL,
  'package_size und package_size_unit müssen gemeinsam gesetzt werden'
);
select throws_ok(
  format($$ insert into public.fridge_items
    (id, household_id, location_id, name, quantity, unit, package_size_unit)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', %L, %L, 'Ohne Größe', 1.0, 'piece', 'g') $$,
    :'hid', :'location_id'
  ),
  '23514',
  NULL,
  'package_size_unit darf nicht ohne package_size gesetzt werden'
);
select throws_ok(
  format($$ insert into public.fridge_items
    (id, household_id, location_id, name, quantity, unit)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', %L, %L, 'Nullbestand', 0.0, 'piece') $$,
    :'hid', :'location_id'
  ),
  '23514',
  NULL,
  'ein aktiver fridge_item darf nicht die Menge null haben'
);
select throws_ok(
  format($$ insert into public.fridge_items
    (id, household_id, location_id, name, quantity, unit, deleted_at)
    values ('ffffffff-ffff-4fff-8fff-ffffffffffff', %L, %L, 'Positiver Tombstone', 1.0, 'piece', now()) $$,
    :'hid', :'location_id'
  ),
  '23514',
  NULL,
  'ein Tombstone darf keine positive Menge haben'
);
select throws_ok(
  format($$ insert into public.transactions
    (household_id, fridge_item_id, location_id, quantity, type, operation_id, notes)
    values (%L, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', %L, 1.0, 'open',
      '11111111-aaaa-4aaa-8aaa-111111111111', 'Legacy') $$,
    :'hid', :'location_id'
  ),
  '23514',
  NULL,
  'transactions weist den entfernten open-Typ zurück'
);
select throws_ok(
  format($$ insert into public.transactions
    (household_id, fridge_item_id, location_id, quantity, type, operation_id)
    values (%L, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', %L, 1.0, 'waste',
      '44444444-aaaa-4aaa-8aaa-444444444444') $$,
    :'hid', :'location_id'
  ),
  '23514',
  NULL,
  'waste-Transaktionen benötigen einen Grund'
);
-- Der Trigger muss einen mitgeschickten Wert ueberschreiben — sonst koennte ein
-- Client seinen eigenen updated_at setzen und sich im Last-Write-Wins nach vorn
-- schummeln.
--
-- Nicht testbar ist hier "Zeitstempel waechst bei jedem UPDATE": `now()` liefert
-- die Transaktions-Startzeit und ist innerhalb einer Transaktion konstant.
-- pgTAP kapselt jede Datei in genau eine — ein Vergleich zweier Zeitpunkte
-- waere immer gleich.
update public.fridge_items set updated_at = '2020-01-01'::timestamptz where household_id = :'hid';

select isnt(
  (select min(updated_at) from public.fridge_items where household_id = :'hid'),
  '2020-01-01'::timestamptz,
  'der Trigger ueberschreibt ein vom Client gesetztes updated_at'
);

-- Dasselbe fuer household_members. `guard_last_admin` feuert hier nicht: Es
-- wird kein Admin degradiert, nur ein Zeitstempel angefasst. Die beiden
-- BEFORE-Trigger laufen in alphabetischer Namensreihenfolge, `guard` also vor
-- `set_updated_at`; `guard` gibt coalesce(new, old) zurueck und laesst NEW
-- unveraendert durch.
update public.household_members set updated_at = '2020-01-01'::timestamptz where household_id = :'hid';

select isnt(
  (select min(updated_at) from public.household_members where household_id = :'hid'),
  '2020-01-01'::timestamptz,
  'der Trigger ueberschreibt ein vom Client gesetztes updated_at auch auf household_members'
);

-- ------------------------------------------------------------------ Tombstone
-- Ein inkrementeller Pull muss geloeschte Zeilen MITLIEFERN. Verschwaende die
-- Zeile hart, koennte ein Client, der waehrend des Loeschens offline war, nicht
-- unterscheiden zwischen "geloescht" und "noch nie gesehen".
select throws_ok(
  format($$ update public.fridge_items set quantity = 0 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$),
  '23514',
  NULL,
  'ein aktiver fridge_item darf nicht auf null gesetzt werden'
);
select throws_ok(
  format($$ update public.fridge_items set deleted_at = now() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$),
  '23514',
  NULL,
  'ein Tombstone darf nicht mit positiver Menge gespeichert werden'
);
update public.fridge_items
   set quantity = 0, deleted_at = now()
 where household_id = :'hid';

insert into public.transactions
  (household_id, fridge_item_id, location_id, quantity, type, operation_id)
values (
  :'hid',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'location_id',
  1.0,
  'in',
  '33333333-aaaa-4aaa-8aaa-333333333333'
);

select is(
  (select count(*)::int from public.fridge_items
   where updated_at > '2020-01-01'::timestamptz and household_id = :'hid'),
  1,
  'die geloeschte Zeile taucht im inkrementellen Pull weiterhin auf (Tombstone)'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  format($$ insert into public.transactions
    (household_id, fridge_item_id, location_id, quantity, type, operation_id)
    values (%L, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', %L, 1.0, 'in',
      '22222222-aaaa-4aaa-8aaa-222222222222') $$,
    :'hid', :'location_id'
  ),
  '42501',
  NULL,
  'authenticated darf transactions nicht direkt mutieren'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::int from public.fridge_items where household_id = :'hid'),
  0,
  'ein anderes Haushaltsmitglied sieht keine fremden fridge_items'
);
select is(
  (select count(*)::int from public.transactions where household_id = :'hid'),
  0,
  'ein anderes Haushaltsmitglied sieht keine fremden transactions'
);

-- --------------------------------------------------------- Realtime-Publication
select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'fridge_items'
  ),
  'fridge_items liegt in der Realtime-Publication'
);

select ok(
  exists (
    select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'transactions'
  ),
  'transactions liegt in der Realtime-Publication'
);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'shopping_list_items'
  ),
  'shopping_list_items liegt in der Realtime-Publication'
);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'shopping_category_preferences'
  ),
  'shopping_category_preferences liegt in der Realtime-Publication'
);

-- Die privaten Tabellen duerfen NICHT drin sein. Realtime waere ein zweiter
-- Kanal an RLS vorbei, wenn die Konfiguration jemals nachlaesst.
select is_empty(
  $$ select tablename from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename in ('food_entries', 'weight_entries', 'user_goals') $$,
  'keine private Tracking-Tabelle liegt in der Realtime-Publication'
);

-- REPLICA IDENTITY FULL: ohne die kann Realtime RLS nicht auswerten und
-- verschickt Events im Zweifel an Clients, die die Zeile nicht sehen duerfen.
select is(
  (select relreplident from pg_class where oid = 'public.fridge_items'::regclass),
  'f'::"char",
  'fridge_items hat REPLICA IDENTITY FULL — sonst greift RLS in Realtime nicht'
);

select is(
  (select relreplident from pg_class where oid = 'public.transactions'::regclass),
  'f'::"char",
  'transactions hat REPLICA IDENTITY FULL'
);

select is(
  (select relreplident from pg_class where oid = 'public.shopping_list_items'::regclass),
  'f'::"char",
  'shopping_list_items hat REPLICA IDENTITY FULL'
);

select is(
  (select relreplident from pg_class
   where oid = 'public.shopping_category_preferences'::regclass),
  'f'::"char",
  'shopping_category_preferences hat REPLICA IDENTITY FULL'
);

select * from finish();
rollback;
