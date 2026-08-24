/**
 * Tests für die SQLite-Ein-/Ausgabe der CI-Delta-Pipeline (#223 Paket 5).
 * Bislang ungetestet — `dump-sqlite-io.ts` ist der einzige Kontaktpunkt zu
 * `bun:sqlite` und wurde nur indirekt über manuelle CI-Läufe geprüft.
 *
 * Deckt insbesondere die Regression ab, die ein lokaler Testlauf aufgedeckt
 * hat: `writePatchDb()` legte die sieben Nährwert-Spalten mit `text`- statt
 * `real`-Typaffinität an. `computePatch()` (`dump-patch-core.ts`) vergleicht
 * Felder mit strikter `===` — eine als `"45"` (string) zurückgelesene Zahl
 * ist dort ungleich zur `45` (number) aus einem frischen Dump, jedes Produkt
 * wäre nach einer Rekonstruktion fälschlich als geändert erkannt worden.
 */

import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { PatchProductRecord } from './dump-patch-core';
import {
  PRODUCT_COLUMNS,
  productColumnDefsSql,
  quickCheck,
  readDumpMeta,
  readPatchDb,
  readProducts,
  writePatchDb,
} from './dump-sqlite-io';

function product(overrides: Partial<PatchProductRecord> & { code: string }): PatchProductRecord {
  return {
    code: overrides.code,
    product_name: overrides.product_name ?? 'Testprodukt',
    brand: overrides.brand ?? null,
    quantity: overrides.quantity ?? null,
    stores: overrides.stores ?? null,
    nutriscore: overrides.nutriscore ?? null,
    categories_tags: overrides.categories_tags ?? '[]',
    off_last_modified_at: overrides.off_last_modified_at ?? null,
    energy_kcal: overrides.energy_kcal ?? 45,
    fat: overrides.fat ?? 0,
    saturated_fat: overrides.saturated_fat ?? 0,
    carbohydrates: overrides.carbohydrates ?? 10,
    sugars: overrides.sugars ?? 10,
    proteins: overrides.proteins ?? 0,
    salt: overrides.salt ?? 0,
    image_url: overrides.image_url ?? null,
  };
}

/** Baut eine Schema-2-Extract-DB direkt über `bun:sqlite` (kein externes `sqlite3`-Binary nötig). */
function writeSchema2Db(
  filePath: string,
  products: PatchProductRecord[],
  dataVersion: string,
): void {
  const db = new Database(filePath, { create: true });
  try {
    db.exec(`create table products (${productColumnDefsSql()});`);
    db.exec(
      'create table dump_meta (schema_version integer not null, data_version text not null, generated_at text not null, source_cursor text);',
    );
    const insert = db.query(
      `insert into products (${PRODUCT_COLUMNS.join(', ')}) values (${PRODUCT_COLUMNS.map(() => '?').join(', ')})`,
    );
    for (const p of products)
      insert.run(...PRODUCT_COLUMNS.map((col) => p[col as keyof PatchProductRecord]));
    db.query(
      'insert into dump_meta (schema_version, data_version, generated_at, source_cursor) values (2, ?, ?, NULL)',
    ).run(dataVersion, dataVersion);
  } finally {
    db.close();
  }
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'dump-sqlite-io-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('productColumnDefsSql', () => {
  it('deklariert die sieben Nährwert-Spalten als real, alle anderen als text', () => {
    const sql = productColumnDefsSql();
    for (const col of [
      'energy_kcal',
      'fat',
      'saturated_fat',
      'carbohydrates',
      'sugars',
      'proteins',
      'salt',
    ]) {
      expect(sql).toMatch(new RegExp(`\\b${col} real\\b`));
    }
    for (const col of [
      'code',
      'product_name',
      'brand',
      'quantity',
      'stores',
      'nutriscore',
      'categories_tags',
      'off_last_modified_at',
    ]) {
      expect(sql).toMatch(new RegExp(`\\b${col} text\\b`));
    }
  });
});

describe('readProducts / readDumpMeta / quickCheck', () => {
  it('liest Produkte und Metadaten aus einer gültigen Schema-2-Extract-DB', () => {
    const file = path.join(dir, 'extract.db');
    writeSchema2Db(file, [product({ code: '1' })], '2026-08-01T00-00-00Z');

    expect(quickCheck(file)).toBe(true);
    expect(readDumpMeta(file)).toMatchObject({
      schemaVersion: 2,
      dataVersion: '2026-08-01T00-00-00Z',
    });
    expect(readProducts(file)).toEqual([product({ code: '1' })]);
  });

  it('liest Nährwerte als number zurück, nicht als string', () => {
    const file = path.join(dir, 'extract.db');
    writeSchema2Db(file, [product({ code: '1', energy_kcal: 45 })], '2026-08-01T00-00-00Z');

    const [read] = readProducts(file);
    expect(read.energy_kcal).toBe(45);
    expect(typeof read.energy_kcal).toBe('number');
  });

  it('wirft einen Fehler, wenn dump_meta leer ist', () => {
    const file = path.join(dir, 'no-meta.db');
    const db = new Database(file, { create: true });
    db.exec(`create table products (${productColumnDefsSql()});`);
    db.exec(
      'create table dump_meta (schema_version integer not null, data_version text not null, generated_at text not null, source_cursor text);',
    );
    db.close();

    expect(() => readDumpMeta(file)).toThrow(/dump_meta ist leer/);
  });
});

describe('writePatchDb / readPatchDb', () => {
  it('erhält Zahlentypen der Nährwerte über einen Schreib-/Lese-Roundtrip (Regressionstest für den text/real-Bug)', () => {
    const file = path.join(dir, 'patch.db');
    const patch = { upserts: [product({ code: '1', energy_kcal: 45, fat: 1.5 })], deletes: ['2'] };
    writePatchDb(file, { fromVersion: 'a', toVersion: 'b', schemaVersion: 2, patch });

    const result = readPatchDb(file);
    expect(result.upserts).toEqual([product({ code: '1', energy_kcal: 45, fat: 1.5 })]);
    expect(typeof result.upserts[0].energy_kcal).toBe('number');
    expect(typeof result.upserts[0].fat).toBe('number');
    expect(result.deletes).toEqual(['2']);
  });

  it('rundtrippt from/to-Version und einen leeren Patch korrekt', () => {
    const file = path.join(dir, 'empty-patch.db');
    writePatchDb(file, {
      fromVersion: 'v1',
      toVersion: 'v2',
      schemaVersion: 2,
      patch: { upserts: [], deletes: [] },
    });

    const result = readPatchDb(file);
    expect(result).toEqual({ fromVersion: 'v1', toVersion: 'v2', upserts: [], deletes: [] });
  });

  it('behandelt NULL-Nährwerte (fehlende OFF-Daten) korrekt über den Roundtrip', () => {
    const file = path.join(dir, 'nulls.db');
    const withNulls = product({ code: '1', energy_kcal: null, fat: null });
    writePatchDb(file, {
      fromVersion: 'a',
      toVersion: 'b',
      schemaVersion: 2,
      patch: { upserts: [withNulls], deletes: [] },
    });

    const result = readPatchDb(file);
    expect(result.upserts[0].energy_kcal).toBeNull();
    expect(result.upserts[0].fat).toBeNull();
  });
});
