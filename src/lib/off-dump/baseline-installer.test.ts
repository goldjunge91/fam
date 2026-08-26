import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createNodeFileOps } from '../../../test/node-file-ops';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';
import { installBaseline } from './baseline-installer';

const SCHEMA_COLUMNS = ['code', 'product_name'] as const;

function createDumpFile(path: string, dataVersion: string, schemaVersion = 2) {
  const db = new DatabaseSync(path);
  db.exec(`
    create table products (${SCHEMA_COLUMNS.join(' text, ')} text);
    create table dump_meta (schema_version integer not null, data_version text not null, generated_at text not null, source_cursor text);
  `);
  db.prepare(
    'insert into dump_meta (schema_version, data_version, generated_at, source_cursor) values (?, ?, ?, null)',
  ).run(schemaVersion, dataVersion, dataVersion);
  db.prepare(`insert into products (${SCHEMA_COLUMNS.join(', ')}) values (?, ?)`).run(
    '1',
    `Produkt (${dataVersion})`,
  );
  db.close();
}

function checksumOf(path: string): string {
  const { createHash } = require('node:crypto');
  const { readFileSync } = require('node:fs');
  return createHash('md5').update(readFileSync(path)).digest('hex');
}

describe('installBaseline', () => {
  let dir: string;
  let activePath: string;
  let nextPath: string;
  let recoveryPath: string;
  let db: TestDatabase;
  let fileOps: ReturnType<typeof createNodeFileOps>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fam-baseline-installer-'));
    activePath = join(dir, 'off-dump-v2.db');
    nextPath = join(dir, 'off-dump-v2.next.db');
    recoveryPath = join(dir, 'off-dump-v2.recovery.db');
    db = createTestDatabase();
    fileOps = createNodeFileOps();
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function readActiveProducts() {
    return db.getAllAsync<{ code: string; product_name: string }>(
      'select code, product_name from off_dump.products order by code',
    );
  }

  it('Erstinstall (keine vorherige active-Datei): lädt, verifiziert, aktiviert und hängt an', async () => {
    const sourcePath = join(dir, 'source-baseline.db');
    createDumpFile(sourcePath, '2026-08-01T00:00:00.000Z');
    fileOps.registerDownloadSource('https://example/baseline.db', sourcePath);

    const result = await installBaseline(db, fileOps, {
      downloadUrl: 'https://example/baseline.db',
      expectedChecksum: checksumOf(sourcePath),
      expectedSchemaVersion: 2,
      activePath,
      nextPath,
      recoveryPath,
      attachmentMode: 'sqlite',
    });

    expect(result).toEqual({ ok: true, dataVersion: '2026-08-01T00:00:00.000Z' });
    expect(await fileOps.exists(activePath)).toBe(true);
    expect(await fileOps.exists(nextPath)).toBe(false);
    expect(await fileOps.exists(recoveryPath)).toBe(false);
    expect(await readActiveProducts()).toEqual([
      { code: '1', product_name: 'Produkt (2026-08-01T00:00:00.000Z)' },
    ]);
  });

  it('ersetzt eine bestehende active-Datei sicher: alte wird zu recovery, neue wird active, recovery wird danach entfernt', async () => {
    createDumpFile(activePath, '2026-08-01T00:00:00.000Z');
    await db.execAsync(`ATTACH DATABASE '${activePath}' AS off_dump`);

    const sourcePath = join(dir, 'source-new.db');
    createDumpFile(sourcePath, '2026-09-01T00:00:00.000Z');
    fileOps.registerDownloadSource('https://example/baseline-new.db', sourcePath);

    const result = await installBaseline(db, fileOps, {
      downloadUrl: 'https://example/baseline-new.db',
      expectedChecksum: checksumOf(sourcePath),
      expectedSchemaVersion: 2,
      activePath,
      nextPath,
      recoveryPath,
      attachmentMode: 'sqlite',
    });

    expect(result).toEqual({ ok: true, dataVersion: '2026-09-01T00:00:00.000Z' });
    expect(await readActiveProducts()).toEqual([
      { code: '1', product_name: 'Produkt (2026-09-01T00:00:00.000Z)' },
    ]);
    expect(await fileOps.exists(recoveryPath)).toBe(false);
    expect(await fileOps.exists(nextPath)).toBe(false);
  });

  it('lehnt eine Datei mit falscher Prüfsumme ab, löscht next, active bleibt unangetastet', async () => {
    createDumpFile(activePath, '2026-08-01T00:00:00.000Z');
    await db.execAsync(`ATTACH DATABASE '${activePath}' AS off_dump`);

    const sourcePath = join(dir, 'source-tampered.db');
    createDumpFile(sourcePath, '2026-09-01T00:00:00.000Z');
    fileOps.registerDownloadSource('https://example/baseline.db', sourcePath);

    const result = await installBaseline(db, fileOps, {
      downloadUrl: 'https://example/baseline.db',
      expectedChecksum: 'komplett-falsche-pruefsumme',
      expectedSchemaVersion: 2,
      activePath,
      nextPath,
      recoveryPath,
      attachmentMode: 'sqlite',
    });

    expect(result).toEqual({ ok: false, reason: 'checksum_mismatch' });
    expect(await fileOps.exists(nextPath)).toBe(false);
    expect(await readActiveProducts()).toEqual([
      { code: '1', product_name: 'Produkt (2026-08-01T00:00:00.000Z)' },
    ]);
  });

  it('lehnt eine Datei mit abweichender Schemaversion ab, löscht next, active bleibt unangetastet', async () => {
    createDumpFile(activePath, '2026-08-01T00:00:00.000Z');
    await db.execAsync(`ATTACH DATABASE '${activePath}' AS off_dump`);

    const sourcePath = join(dir, 'source-wrong-schema.db');
    createDumpFile(sourcePath, '2026-09-01T00:00:00.000Z', 1);
    fileOps.registerDownloadSource('https://example/baseline.db', sourcePath);

    const result = await installBaseline(db, fileOps, {
      downloadUrl: 'https://example/baseline.db',
      expectedChecksum: checksumOf(sourcePath),
      expectedSchemaVersion: 2,
      activePath,
      nextPath,
      recoveryPath,
      attachmentMode: 'sqlite',
    });

    expect(result).toEqual({ ok: false, reason: 'schema_mismatch' });
    expect(await fileOps.exists(nextPath)).toBe(false);
  });

  it('lehnt eine beschädigte Datei (quick_check fehlgeschlagen) ab, löscht next', async () => {
    createDumpFile(activePath, '2026-08-01T00:00:00.000Z');
    await db.execAsync(`ATTACH DATABASE '${activePath}' AS off_dump`);

    const sourcePath = join(dir, 'source-corrupt.db');
    createDumpFile(sourcePath, '2026-09-01T00:00:00.000Z');
    fileOps.registerDownloadSource('https://example/baseline.db', sourcePath);

    // quick_check an einer echten, byte-fuer-byte kaputten SQLite-Datei ist
    // brueckig gegenueber der SQLite-Version — stattdessen die Entscheidung
    // isoliert testen: alles bleibt echt (node:fs/node:sqlite), nur
    // inspectDump() meldet fuer DIESEN einen Aufruf bewusst integrityOk:false.
    const realInspect = fileOps.inspectDump.bind(fileOps);
    fileOps.inspectDump = async (path: string) => {
      const real = await realInspect(path);
      return real ? { ...real, integrityOk: false } : real;
    };

    const result = await installBaseline(db, fileOps, {
      downloadUrl: 'https://example/baseline.db',
      expectedChecksum: checksumOf(sourcePath),
      expectedSchemaVersion: 2,
      activePath,
      nextPath,
      recoveryPath,
      attachmentMode: 'sqlite',
    });

    expect(result).toEqual({ ok: false, reason: 'corrupted' });
    expect(await fileOps.exists(nextPath)).toBe(false);
  });
});
