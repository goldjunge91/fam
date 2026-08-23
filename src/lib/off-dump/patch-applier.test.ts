import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';
import { applyPatch } from './patch-applier';

const PRODUCT_COLUMNS = [
  'code',
  'product_name',
  'brand',
  'quantity',
  'stores',
  'nutriscore',
  'categories_tags',
  'off_last_modified_at',
  'energy_kcal',
  'fat',
  'saturated_fat',
  'carbohydrates',
  'sugars',
  'proteins',
  'salt',
] as const;

function seedOffDumpSchema(db: DatabaseSync, dataVersion: string, schemaVersion = 2) {
  const [codeColumn, ...restColumns] = PRODUCT_COLUMNS;
  db.exec(`
    create table products (${codeColumn} text primary key, ${restColumns.join(' text, ')} text);
    create table dump_meta (schema_version integer not null, data_version text not null, generated_at text not null, source_cursor text);
  `);
  db.prepare(
    'insert into dump_meta (schema_version, data_version, generated_at, source_cursor) values (?, ?, ?, null)',
  ).run(schemaVersion, dataVersion, dataVersion);
}

function insertProduct(db: DatabaseSync, code: string, name: string) {
  const placeholders = PRODUCT_COLUMNS.map(() => '?').join(', ');
  db.prepare(`insert into products (${PRODUCT_COLUMNS.join(', ')}) values (${placeholders})`).run(
    code,
    name,
    null,
    null,
    null,
    null,
    '[]',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  );
}

function seedPatchDb(
  db: DatabaseSync,
  params: {
    fromVersion: string;
    toVersion: string;
    schemaVersion?: number;
    upserts?: Array<{ code: string; name: string }>;
    deletes?: string[];
  },
) {
  const { fromVersion, toVersion, schemaVersion = 2, upserts = [], deletes = [] } = params;
  db.exec(`
    create table patch_meta (from_version text not null, to_version text not null, schema_version integer not null, generated_at text not null, upsert_count integer not null, delete_count integer not null);
    create table product_upserts (${PRODUCT_COLUMNS.join(' text, ')} text);
    create table product_deletes (code text primary key);
  `);
  db.prepare(
    'insert into patch_meta (from_version, to_version, schema_version, generated_at, upsert_count, delete_count) values (?, ?, ?, ?, ?, ?)',
  ).run(fromVersion, toVersion, schemaVersion, toVersion, upserts.length, deletes.length);

  const placeholders = PRODUCT_COLUMNS.map(() => '?').join(', ');
  for (const { code, name } of upserts) {
    db.prepare(
      `insert into product_upserts (${PRODUCT_COLUMNS.join(', ')}) values (${placeholders})`,
    ).run(code, name, null, null, null, null, '[]', null, null, null, null, null, null, null, null);
  }
  for (const code of deletes) {
    db.prepare('insert into product_deletes (code) values (?)').run(code);
  }
}

describe('applyPatch', () => {
  let dir: string;
  let offDumpPath: string;
  let db: TestDatabase;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fam-patch-applier-'));
    offDumpPath = join(dir, 'off-dump-v2.db');

    const raw = new DatabaseSync(offDumpPath);
    seedOffDumpSchema(raw, '2026-08-01T00:00:00.000Z');
    insertProduct(raw, '1', 'Apfel');
    insertProduct(raw, '2', 'Wein');
    raw.close();

    db = createTestDatabase();
    db.execAsync(`ATTACH DATABASE '${offDumpPath}' AS off_dump`);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function readOffDumpProducts() {
    return db.getAllAsync<{ code: string; product_name: string }>(
      'select code, product_name from off_dump.products order by code',
    );
  }

  async function readDataVersion() {
    const row = await db.getFirstAsync<{ data_version: string }>(
      'select data_version from off_dump.dump_meta limit 1',
    );
    return row?.data_version;
  }

  it('wendet Upserts und Deletes transaktional an und aktualisiert data_version', async () => {
    const patchPath = join(dir, 'patch-1.db');
    const patchDb = new DatabaseSync(patchPath);
    seedPatchDb(patchDb, {
      fromVersion: '2026-08-01T00:00:00.000Z',
      toVersion: '2026-08-02T00:00:00.000Z',
      upserts: [
        { code: '1', name: 'Apfel Bio' },
        { code: '3', name: 'Käse' },
      ],
      deletes: ['2'],
    });
    patchDb.close();

    const result = await applyPatch(db, {
      patchDbPath: patchPath,
      expectedFromVersion: '2026-08-01T00:00:00.000Z',
      expectedSchemaVersion: 2,
      toVersion: '2026-08-02T00:00:00.000Z',
    });

    expect(result).toEqual({ ok: true });
    expect(await readOffDumpProducts()).toEqual([
      { code: '1', product_name: 'Apfel Bio' },
      { code: '3', product_name: 'Käse' },
    ]);
    expect(await readDataVersion()).toBe('2026-08-02T00:00:00.000Z');
  });

  it('lehnt einen Patch mit falscher from_version ab, ohne etwas zu ändern', async () => {
    const patchPath = join(dir, 'patch-wrong-from.db');
    const patchDb = new DatabaseSync(patchPath);
    seedPatchDb(patchDb, {
      fromVersion: '2099-01-01T00:00:00.000Z',
      toVersion: '2099-01-02T00:00:00.000Z',
      upserts: [{ code: '1', name: 'Sollte nicht ankommen' }],
    });
    patchDb.close();

    const result = await applyPatch(db, {
      patchDbPath: patchPath,
      expectedFromVersion: '2026-08-01T00:00:00.000Z',
      expectedSchemaVersion: 2,
      toVersion: '2099-01-02T00:00:00.000Z',
    });

    expect(result).toEqual({ ok: false, reason: 'from_version_mismatch' });
    expect(await readOffDumpProducts()).toEqual([
      { code: '1', product_name: 'Apfel' },
      { code: '2', product_name: 'Wein' },
    ]);
    expect(await readDataVersion()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('lehnt einen Patch mit abweichender Schemaversion ab, ohne etwas zu ändern', async () => {
    const patchPath = join(dir, 'patch-wrong-schema.db');
    const patchDb = new DatabaseSync(patchPath);
    seedPatchDb(patchDb, {
      fromVersion: '2026-08-01T00:00:00.000Z',
      toVersion: '2026-08-02T00:00:00.000Z',
      schemaVersion: 1,
      upserts: [{ code: '1', name: 'Sollte nicht ankommen' }],
    });
    patchDb.close();

    const result = await applyPatch(db, {
      patchDbPath: patchPath,
      expectedFromVersion: '2026-08-01T00:00:00.000Z',
      expectedSchemaVersion: 2,
      toVersion: '2026-08-02T00:00:00.000Z',
    });

    expect(result).toEqual({ ok: false, reason: 'schema_mismatch' });
    expect(await readOffDumpProducts()).toEqual([
      { code: '1', product_name: 'Apfel' },
      { code: '2', product_name: 'Wein' },
    ]);
  });

  it('detacht die Patch-Datenbank in jedem Fall (Erfolg und Ablehnung)', async () => {
    const patchPath = join(dir, 'patch-detach.db');
    const patchDb = new DatabaseSync(patchPath);
    seedPatchDb(patchDb, {
      fromVersion: '2026-08-01T00:00:00.000Z',
      toVersion: '2026-08-02T00:00:00.000Z',
    });
    patchDb.close();

    await applyPatch(db, {
      patchDbPath: patchPath,
      expectedFromVersion: '2026-08-01T00:00:00.000Z',
      expectedSchemaVersion: 2,
      toVersion: '2026-08-02T00:00:00.000Z',
    });

    await expect(
      db.execAsync(`ATTACH DATABASE '${patchPath}' AS off_patch`),
    ).resolves.toBeUndefined();
  });

  it('rollt bei einem Fehler mitten in der Transaktion vollständig zurück (alter Dump bleibt aktiv)', async () => {
    const patchPath = join(dir, 'patch-broken.db');
    const patchDb = new DatabaseSync(patchPath);
    // Erzwingt einen eindeutigen Spaltenzahlfehler im INSERT...SELECT.
    const brokenColumns = PRODUCT_COLUMNS.slice(0, -1);
    patchDb.exec(`
      create table patch_meta (from_version text not null, to_version text not null, schema_version integer not null, generated_at text not null, upsert_count integer not null, delete_count integer not null);
      create table product_upserts (${brokenColumns.join(' text, ')} text);
      create table product_deletes (code text primary key);
    `);
    patchDb
      .prepare(
        'insert into patch_meta (from_version, to_version, schema_version, generated_at, upsert_count, delete_count) values (?, ?, ?, ?, ?, ?)',
      )
      .run(
        '2026-08-01T00:00:00.000Z',
        '2026-08-02T00:00:00.000Z',
        2,
        '2026-08-02T00:00:00.000Z',
        1,
        0,
      );
    const placeholders = brokenColumns.map(() => '?').join(', ');
    patchDb
      .prepare(`insert into product_upserts (${brokenColumns.join(', ')}) values (${placeholders})`)
      .run(
        '1',
        'Sollte zurueckgerollt werden',
        null,
        null,
        null,
        null,
        '[]',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      );
    patchDb.close();

    await expect(
      applyPatch(db, {
        patchDbPath: patchPath,
        expectedFromVersion: '2026-08-01T00:00:00.000Z',
        expectedSchemaVersion: 2,
        toVersion: '2026-08-02T00:00:00.000Z',
      }),
    ).rejects.toThrow();

    expect(await readOffDumpProducts()).toEqual([
      { code: '1', product_name: 'Apfel' },
      { code: '2', product_name: 'Wein' },
    ]);
    expect(await readDataVersion()).toBe('2026-08-01T00:00:00.000Z');
  });
});
