-- Sync-Metadaten und Realtime-Publication (#42, #44, #43).
--
-- Diese Suite prueft Voraussetzungen der Offline-Engine (Epic 2). Faellt eine
-- davon weg, merkt man es sonst erst daran, dass Daten verschwinden oder
-- wieder auftauchen — Wochen spaeter und schwer zurueckzuverfolgen.

begin;
\ir helpers.sql

select plan(11);

-- ------------------------------------------------- Sync-Spalten auf allen Tabellen
-- `updated_at` treibt den inkrementellen Pull, `deleted_at` die Tombstones.
-- Ohne beide ist Last-Write-Wins nicht entscheidbar.
select has_column('public', 'fridge_items', 'updated_at', 'fridge_items hat updated_at');
select has_column('public', 'fridge_items', 'deleted_at', 'fridge_items hat deleted_at');
select has_column('public', 'shopping_list_items', 'deleted_at', 'shopping_list_items hat deleted_at');
select has_column('public', 'food_entries', 'deleted_at', 'food_entries hat deleted_at');

-- ------------------------------------------------------- updated_at-Automatik
select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

insert into public.fridge_items (household_id, name, added_by)
values (:'hid', 'Milch', '11111111-1111-1111-1111-111111111111');

select tests.as_postgres();

-- Der Trigger muss einen mitgeschickten Wert ueberschreiben — sonst koennte ein
-- Client seinen eigenen updated_at setzen und sich im Last-Write-Wins nach vorn
-- schummeln.
--
-- Nicht testbar ist hier "Zeitstempel waechst bei jedem UPDATE": `now()` liefert
-- die Transaktions-Startzeit und ist innerhalb einer Transaktion konstant.
-- pgTAP kapselt jede Datei in genau eine — ein Vergleich zweier Zeitpunkte
-- waere immer gleich.
update public.fridge_items set updated_at = '2020-01-01'::timestamptz;

select isnt(
  (select updated_at from public.fridge_items),
  '2020-01-01'::timestamptz,
  'der Trigger ueberschreibt ein vom Client gesetztes updated_at'
);

-- ------------------------------------------------------------------ Tombstone
-- Ein inkrementeller Pull muss geloeschte Zeilen MITLIEFERN. Verschwaende die
-- Zeile hart, koennte ein Client, der waehrend des Loeschens offline war, nicht
-- unterscheiden zwischen "geloescht" und "noch nie gesehen".
update public.fridge_items set deleted_at = now();

select is(
  (select count(*)::int from public.fridge_items
   where updated_at > '2020-01-01'::timestamptz),
  1,
  'die geloeschte Zeile taucht im inkrementellen Pull weiterhin auf (Tombstone)'
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
      and schemaname = 'public' and tablename = 'shopping_list_items'
  ),
  'shopping_list_items liegt in der Realtime-Publication'
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
  (select relreplident from pg_class where oid = 'public.shopping_list_items'::regclass),
  'f'::"char",
  'shopping_list_items hat REPLICA IDENTITY FULL'
);

select * from finish();
rollback;
