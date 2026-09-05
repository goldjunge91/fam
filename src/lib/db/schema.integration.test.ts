import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { readUserVersion, runMigrations } from '@/lib/db/migrator';
import type { Migration } from '@/lib/db/types';
import {
  countingDatabase,
  createTestDatabase,
  type TestDatabase,
} from '../../../test/node-sqlite-adapter';

/**
 * Das lokale Schema gegen eine echte SQLite-Engine (#45).
 *
 * Laeuft ueber `node:sqlite`, nicht ueber `expo-sqlite` — siehe
 * `test/node-sqlite-adapter.ts`. Kein Mock: Die Tabellen entstehen wirklich,
 * Constraints greifen wirklich, ein Rollback dreht wirklich zurueck.
 */

const MIRROR_TABLES = [
  'storage_locations',
  'fridge_items',
  'transactions',
  'shopping_list_items',
  'shopping_category_preferences',
  'products',
  'households',
] as const;

type ColumnInfo = { name: string; type: string; notnull: number };

async function columnsOf(db: TestDatabase, table: string): Promise<ColumnInfo[]> {
  return db.getAllAsync<ColumnInfo>(`PRAGMA table_info(${table})`);
}

describe('lokales Schema', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('legt die Spiegeltabellen der neuen fam-v2-Baseline an', async () => {
    const tables = await db.getAllAsync<{ name: string }>(
      "select name from sqlite_master where type = 'table' order by name",
    );
    const names = tables.map((t) => t.name);

    for (const table of MIRROR_TABLES) {
      expect(names).toContain(table);
    }
  });

  it('legt zusaetzlich households an (Migration v6, lokaler Haushalts-Spiegel)', async () => {
    const tables = await db.getAllAsync<{ name: string }>(
      "select name from sqlite_master where type = 'table' and name = 'households'",
    );
    expect(tables).toHaveLength(1);
  });

  it('legt die Inventory-Lifecycle-Spalten und das Transaktionsschema an', async () => {
    const itemColumns = (await columnsOf(db, 'fridge_items')).map((column) => column.name);
    expect(itemColumns).toEqual(
      expect.arrayContaining(['opened_at', 'vacuum_sealed', 'expiry_user_set']),
    );
    expect((await columnsOf(db, 'transactions')).map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'id',
        'household_id',
        'fridge_item_id',
        'product_id',
        'actor',
        'type',
        'quantity',
        'location_id',
        'reason',
        'previous_expiry_date',
        'notes',
        'undone',
        'created_at',
      ]),
    );
  });

  it('erzwingt die Ledger-Regeln auch lokal in SQLite', async () => {
    await expect(
      db.runAsync(
        `insert into transactions (id, household_id, type, quantity, reason)
         values (?, ?, ?, ?, ?)`,
        ['tx-invalid-reason', 'household-1', 'out', 1, 'expired'],
      ),
    ).rejects.toThrow();
    await expect(
      db.runAsync(
        `insert into transactions (id, household_id, type, quantity)
         values (?, ?, ?, ?)`,
        ['tx-invalid-quantity', 'household-1', 'in', 0],
      ),
    ).rejects.toThrow();
  });

  it('spiegelt Plus und AI getrennt und entfernt den alten Premium-Zustand', async () => {
    const names = (await columnsOf(db, 'households')).map((column) => column.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'plus_active',
        'plus_expires_at',
        'plus_updated_at',
        'ai_active',
        'ai_expires_at',
        'ai_updated_at',
        'ai_subscriber_id',
      ]),
    );
    expect(names).not.toEqual(
      expect.arrayContaining(['premium_active', 'premium_expires_at', 'premium_updated_at']),
    );
  });

  it('legt Outbox, Sync-Stand und app_meta an', async () => {
    const tables = await db.getAllAsync<{ name: string }>(
      "select name from sqlite_master where type = 'table'",
    );
    const names = tables.map((t) => t.name);

    expect(names).toContain('outbox');
    expect(names).toContain('sync_state');
    expect(names).toContain('app_meta');
  });

  it.each(MIRROR_TABLES)(
    'gibt %s die Sync-Spalten updated_at, deleted_at und _dirty',
    async (table) => {
      const names = (await columnsOf(db, table)).map((c) => c.name);

      expect(names).toContain('updated_at');
      expect(names).toContain('deleted_at');
      expect(names).toContain('_dirty');
    },
  );

  it.each(MIRROR_TABLES)(
    'speichert updated_at von %s als INTEGER (epoch ms), nicht als Text',
    async (table) => {
      // Zeitstempel als Text zu vergleichen ist unsicher: "+00:00" gegen "Z",
      // drei gegen sechs Nachkommastellen. Die Ordnung im Pull muss numerisch
      // sein, sonst sortiert der Cursor falsch.
      const updatedAt = (await columnsOf(db, table)).find((c) => c.name === 'updated_at');

      expect(updatedAt?.type.toUpperCase()).toBe('INTEGER');
      expect(updatedAt?.notnull).toBe(1);
    },
  );

  it('legt die Outbox mit genau den Spalten aus #46 an, plus next_attempt_at', async () => {
    const names = (await columnsOf(db, 'outbox')).map((c) => c.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'id',
        'entity',
        'entity_id',
        'op',
        'payload',
        'created_at',
        'attempts',
        'last_error',
        'next_attempt_at',
      ]),
    );
  });

  it('verwendet fuer Kategorie-Snapshots nur stabile IDs, Quelle und Klassifikatorversion', async () => {
    const itemColumns = (await columnsOf(db, 'shopping_list_items')).map((column) => column.name);
    const historyColumns = (await columnsOf(db, 'shopping_history')).map((column) => column.name);

    for (const columns of [itemColumns, historyColumns]) {
      expect(columns).not.toContain('category');
      expect(columns).toEqual(
        expect.arrayContaining(['category_id', 'category_source', 'category_classifier_version']),
      );
    }
  });

  it('spiegelt OFF-Tags als JSON-Text und den OFF-Zeitstempel im lokalen Products-Cache', async () => {
    const productColumns = (await columnsOf(db, 'products')).map((column) => column.name);

    expect(productColumns).toEqual(
      expect.arrayContaining(['off_category_tags', 'off_last_modified_at']),
    );

    await db.runAsync(
      `insert into products (id, name, updated_at)
       values ('product-1', 'Vollmilch', 1)`,
    );
    const row = await db.getFirstAsync<{ off_category_tags: string }>(
      `select off_category_tags from products where id = 'product-1'`,
    );
    expect(row?.off_category_tags).toBe('[]');
  });

  it('reserviert die natuerliche Preference-Identitaet auch fuer lokale Tombstones', async () => {
    const insert = (id: string, deletedAt: number | null) =>
      db.runAsync(
        `insert into shopping_category_preferences
           (id, household_id, key_type, normalized_key_value, category_id,
            created_at, updated_at, deleted_at, _dirty)
         values (?, 'household-1', 'name', 'vollmilch', null, '2026-08-22', 1, ?, 1)`,
        [id, deletedAt],
      );

    await insert('preference-1', 1);
    await expect(insert('preference-2', null)).rejects.toThrow();
  });

  it('erzwingt in der Outbox die drei erlaubten Operationen', async () => {
    // Echter CHECK-Constraint, kein nachgebautes Verhalten.
    await expect(
      db.runAsync(
        'insert into outbox (entity, entity_id, op, payload, created_at) values (?, ?, ?, ?, ?)',
        ['fridge_items', 'abc', 'sync', '{}', 1],
      ),
    ).rejects.toThrow();
  });

  it('vergibt Outbox-ids monoton — auch nachdem Eintraege geloescht wurden', async () => {
    // Ohne AUTOINCREMENT verwendet SQLite geloeschte rowids wieder. Weil ein
    // erfolgreicher Push seine Zeilen loescht, waeren neue Eintraege dann
    // kleiner als die noch wartenden — und die Erstellungsreihenfolge aus #46,
    // an der die Push-Schleife haengt, kehrte sich still um.
    const insert = async (entityId: string) =>
      db.runAsync(
        'insert into outbox (entity, entity_id, op, payload, created_at) values (?, ?, ?, ?, ?)',
        ['fridge_items', entityId, 'insert', '{}', 1],
      );

    const first = await insert('a');
    const second = await insert('b');
    await db.runAsync('delete from outbox');
    const third = await insert('c');

    expect(second.lastInsertRowId).toBeGreaterThan(first.lastInsertRowId);
    expect(third.lastInsertRowId).toBeGreaterThan(second.lastInsertRowId);
  });

  it('setzt user_version auf die hoechste angewandte Migration', async () => {
    const highest = MIGRATIONS[MIGRATIONS.length - 1].version;
    expect(await readUserVersion(db)).toBe(highest);
  });
});

describe('Migrations-Runner', () => {
  let directory: string;
  let path: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'fam-db-'));
    path = join(directory, 'test.db');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('migriert beim zweiten Oeffnen derselben Datei kein zweites Mal', async () => {
    const first = createTestDatabase(path);
    await runMigrations(first, MIGRATIONS);
    first.close();

    // Dieselbe Datei erneut oeffnen — wie ein App-Neustart.
    const second = createTestDatabase(path);
    const counted = countingDatabase(second);
    await runMigrations(counted, MIGRATIONS);

    expect(counted.executed).toEqual([]);
    expect(await readUserVersion(second)).toBe(MIGRATIONS[MIGRATIONS.length - 1].version);
    second.close();
  });

  it('haelt die Daten aus dem ersten Start ueber den zweiten hinweg', async () => {
    const first = createTestDatabase(path);
    await runMigrations(first, MIGRATIONS);
    await first.runAsync('insert into app_meta (key, value) values (?, ?)', ['user_id', 'alice']);
    first.close();

    const second = createTestDatabase(path);
    await runMigrations(second, MIGRATIONS);
    const row = await second.getFirstAsync<{ value: string }>(
      'select value from app_meta where key = ?',
      ['user_id'],
    );

    expect(row?.value).toBe('alice');
    second.close();
  });

  it('hinterlaesst bei einer fehlerhaften Migration keinen halben Zustand', async () => {
    // Echtes ungueltiges SQL, kein erzwungener Fehler: Die Transaktion muss
    // die bereits angelegte Tabelle mit zurueckdrehen und user_version darf
    // nicht steigen — sonst startet die App beim naechsten Mal mit einem
    // halben Schema und ueberspringt die Migration fuer immer.
    const broken: readonly Migration[] = [
      {
        version: 1,
        name: 'kaputt',
        statements: ['create table haelfte (id text primary key)', 'das ist kein sql'],
      },
    ];

    const database = createTestDatabase();

    await expect(runMigrations(database, broken)).rejects.toThrow();
    expect(await readUserVersion(database)).toBe(0);

    const tables = await database.getAllAsync<{ name: string }>(
      "select name from sqlite_master where type = 'table' and name = 'haelfte'",
    );
    expect(tables).toEqual([]);

    database.close();
  });
});
