-- Sync-Metadaten und Realtime-Publication (#42, #44, #43).
-- Diese Invarianten verhindern stille Datenverluste der Offline-Engine.

begin;
\ir helpers.sql

select plan(17);

-- updated_at treibt den Pull, deleted_at liefert Tombstones.
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

select has_column('public', 'storage_locations', 'deleted_at', 'storage_locations hat deleted_at');

-- Membership-Aenderungen muessen im inkrementellen Pull sichtbar sein.
select has_column('public', 'household_members', 'updated_at', 'household_members hat updated_at');

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

insert into public.fridge_items (household_id, name, added_by)
values (:'hid', 'Milch', '11111111-1111-1111-1111-111111111111');

select tests.as_postgres();

-- Clients duerfen updated_at nicht manipulieren. now() bleibt innerhalb der
-- pgTAP-Transaktion konstant, daher wird nur das Ueberschreiben getestet.
update public.fridge_items set updated_at = '2020-01-01'::timestamptz where household_id = :'hid';

select isnt(
  (select min(updated_at) from public.fridge_items where household_id = :'hid'),
  '2020-01-01'::timestamptz,
  'der Trigger ueberschreibt ein vom Client gesetztes updated_at'
);

update public.household_members set updated_at = '2020-01-01'::timestamptz where household_id = :'hid';

select isnt(
  (select min(updated_at) from public.household_members where household_id = :'hid'),
  '2020-01-01'::timestamptz,
  'der Trigger ueberschreibt ein vom Client gesetztes updated_at auch auf household_members'
);

-- Inkrementelle Pulls muessen geloeschte Zeilen als Tombstones mitliefern.
update public.fridge_items set deleted_at = now() where household_id = :'hid';

select is(
  (select count(*)::int from public.fridge_items
   where updated_at > '2020-01-01'::timestamptz and household_id = :'hid'),
  1,
  'die geloeschte Zeile taucht im inkrementellen Pull weiterhin auf (Tombstone)'
);

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

-- Private Tabellen duerfen keinen zusaetzlichen Realtime-Kanal erhalten.
select is_empty(
  $$ select tablename from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename in ('food_entries', 'weight_entries', 'user_goals') $$,
  'keine private Tracking-Tabelle liegt in der Realtime-Publication'
);

-- REPLICA IDENTITY FULL ist fuer die Realtime-RLS-Auswertung erforderlich.
select is(
  (select relreplident from pg_class where oid = 'public.fridge_items'::regclass),
  'f'::"char",
  'fridge_items hat REPLICA IDENTITY FULL — sonst greift RLS in Realtime nicht'
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
