import type { Migration } from '@/lib/db/types';

/**
 * Das lokale Schema (#45) — nummeriert und ausschliesslich vorwaerts.
 *
 * Reine Daten, keine I/O. Der Runner in `migrator.ts` wendet sie an, die
 * Auswahl trifft `planMigrations()`; beides ist dadurch ohne Datenbank pruefbar.
 *
 * Eine einmal veroeffentlichte Migration wird nie wieder geaendert. Wer eine
 * Spalte braucht, haengt eine neue Version an — auf den Geraeten draussen ist
 * die alte laengst gelaufen und `PRAGMA user_version` steht entsprechend hoch.
 *
 * Bewusste Abweichungen vom Serverschema:
 *
 * - **`updated_at`/`deleted_at` sind INTEGER (epoch ms)**, nicht TEXT. Ein
 *   Stringvergleich von PostgREST-Zeitstempeln ist unsicher (`+00:00` gegen
 *   `Z`, drei gegen sechs Nachkommastellen) und die Ordnung muss numerisch
 *   sein. Der rohe Server-String ueberlebt nur dort, wo er exakt
 *   zurueckgehen muss: im Pull-Cursor in `sync_state`.
 * - **Keine Fremdschluessel.** Der Pull laeuft Tabelle fuer Tabelle; ein
 *   `fridge_items` mit `location_id` kann vor seinem `storage_locations`
 *   eintreffen. Integritaet erzwingt der Server, der Spiegel ist ein Cache.
 * - **`_dirty`** markiert lokal geaenderte, noch nicht gepushte Zeilen.
 */

const V1_MIRRORS = `
create table if not exists storage_locations (
  id           text primary key not null,
  household_id text not null,
  name         text not null,
  kind         text not null,
  sort_order   integer not null default 0,
  created_at   text,
  updated_at   integer not null,
  deleted_at   integer,
  _dirty       integer not null default 0
);
create index if not exists storage_locations_hh_idx on storage_locations (household_id, sort_order);
create index if not exists storage_locations_dirty_idx on storage_locations (_dirty) where _dirty = 1;

create table if not exists fridge_items (
  id           text primary key not null,
  household_id text not null,
  location_id  text,
  product_id   text,
  name         text not null,
  quantity     real not null default 1,
  unit         text not null default 'piece',
  expiry_date  text,
  added_by     text,
  created_at   text,
  updated_at   integer not null,
  deleted_at   integer,
  _dirty       integer not null default 0
);
create index if not exists fridge_items_hh_idx on fridge_items (household_id, deleted_at);
create index if not exists fridge_items_loc_idx on fridge_items (location_id);
create index if not exists fridge_items_dirty_idx on fridge_items (_dirty) where _dirty = 1;

create table if not exists shopping_list_items (
  id           text primary key not null,
  household_id text not null,
  product_id   text,
  name         text not null,
  quantity     real not null default 1,
  unit         text not null default 'piece',
  category     text,
  sort_index   integer not null default 0,
  checked_at   text,
  checked_by   text,
  added_by     text,
  created_at   text,
  updated_at   integer not null,
  deleted_at   integer,
  _dirty       integer not null default 0
);
create index if not exists shopping_list_items_hh_idx on shopping_list_items (household_id, deleted_at);
create index if not exists shopping_list_items_dirty_idx on shopping_list_items (_dirty) where _dirty = 1;

create table if not exists products (
  id                text primary key not null,
  barcode           text,
  name              text not null,
  brand             text,
  kcal_per_100      real,
  protein_g_per_100 real,
  carbs_g_per_100   real,
  fat_g_per_100     real,
  fiber_g_per_100   real,
  sugar_g_per_100   real,
  salt_g_per_100    real,
  serving_size_g    real,
  source            text not null default 'manual',
  created_by        text,
  created_at        text,
  updated_at        integer not null,
  deleted_at        integer,
  _dirty            integer not null default 0
);
create index if not exists products_barcode_idx on products (barcode);
`;

// `products.deleted_at` existiert serverseitig NICHT und bleibt hier immer
// null. Die Spalte steht nur da, damit alle Spiegeltabellen dieselbe Form
// haben; `entities.ts` kennt den Unterschied ueber `hasServerTombstone`.

const V1_OUTBOX = `
create table if not exists outbox (
  id              integer primary key autoincrement,
  entity          text    not null,
  entity_id       text    not null,
  op              text    not null check (op in ('insert','update','delete')),
  payload         text    not null,
  created_at      integer not null,
  attempts        integer not null default 0,
  last_error      text,
  next_attempt_at integer not null default 0
);
create index if not exists outbox_row_idx on outbox (entity, entity_id, id);
create index if not exists outbox_due_idx on outbox (next_attempt_at, id);
`;

// AUTOINCREMENT ist hier nicht kosmetisch. Ohne das Schluesselwort vergibt
// SQLite geloeschte rowids neu — und weil ein erfolgreicher Push seine
// Outbox-Zeilen loescht, waeren die naechsten Eintraege kleiner als die noch
// wartenden. Die Erstellungsreihenfolge aus #46, an der die Push-Schleife
// haengt, kehrte sich damit still um.
//
// `next_attempt_at` geht ueber die Spaltenliste in #46 hinaus. Das Issue
// verlangt Backoff, nennt aber keine Spalte dafuer; ein reiner In-Memory-Timer
// waere nach jedem App-Start zurueckgesetzt, und ein dauerhaft scheiternder
// Eintrag haemmerte den Server bei jedem Start erneut an.

const V1_STATE = `
create table if not exists sync_state (
  entity         text not null,
  scope          text not null default 'default',
  last_synced_at text,
  last_synced_id text,
  last_run_at    integer,
  last_error     text,
  primary key (entity, scope)
);

create table if not exists app_meta (
  key   text primary key not null,
  value text
);
`;

// `sync_state.last_synced_at` ist als TEXT der ROHE Server-String, nicht
// normalisiert: Er geht unveraendert als Filter an PostgREST zurueck, damit
// keine Mikrosekunde verlorengeht und der Cursor keine Zeile ueberspringt.
//
// `app_meta` belegte Schluessel: 'user_id' (zu welchem Nutzer diese Datenbank
// gehoert — bei Wechsel wird alles geloescht, siehe client.ts) und
// 'server_clock_offset_ms' (siehe sync/server-clock.ts).

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'spiegeltabellen_outbox_sync_state',
    statements: [V1_MIRRORS, V1_OUTBOX, V1_STATE],
  },
];
