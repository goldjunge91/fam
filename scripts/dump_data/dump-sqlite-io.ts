/** Kapselt den `bun:sqlite`-Zugriff der Dump-Delta-Pipeline. */

import { Database } from 'bun:sqlite';
import type { DumpPatch, PatchProductRecord } from './dump-patch-core';

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

export type DumpMeta = {
  schemaVersion: number;
  dataVersion: string;
  generatedAt: string;
  sourceCursor: string | null;
};

export function readProducts(dbPath: string): PatchProductRecord[] {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db.query<PatchProductRecord>(`select ${PRODUCT_COLUMNS.join(', ')} from products`).all();
  } finally {
    db.close();
  }
}

export function readDumpMeta(dbPath: string): DumpMeta {
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db
      .query<{
        schema_version: number;
        data_version: string;
        generated_at: string;
        source_cursor: string | null;
      }>('select schema_version, data_version, generated_at, source_cursor from dump_meta limit 1')
      .get();
    if (!row) throw new Error(`${dbPath}: dump_meta ist leer — kein gültiger Schema-2-Dump.`);
    return {
      schemaVersion: row.schema_version,
      dataVersion: row.data_version,
      generatedAt: row.generated_at,
      sourceCursor: row.source_cursor,
    };
  } finally {
    db.close();
  }
}

/** Integritaetspruefung vor der Veroeffentlichung. */
export function quickCheck(dbPath: string): boolean {
  const db = new Database(dbPath, { readonly: true });
  try {
    const result = db
      .query<{ integrity_check?: string; quick_check?: string }>('PRAGMA quick_check')
      .all();
    // Treiberversionen benennen die Ergebnisspalte unterschiedlich.
    return result.length === 1 && Object.values(result[0]).some((v) => v === 'ok');
  } finally {
    db.close();
  }
}

/** Schreibt Metadaten, Upserts und Deletes in eine Patch-Datenbank. */
export function writePatchDb(
  outPath: string,
  params: { fromVersion: string; toVersion: string; schemaVersion: number; patch: DumpPatch },
): void {
  const { fromVersion, toVersion, schemaVersion, patch } = params;
  const db = new Database(outPath, { create: true });
  try {
    db.exec('PRAGMA journal_mode = MEMORY;');
    db.exec(`
      create table patch_meta (
        from_version text not null,
        to_version text not null,
        schema_version integer not null,
        generated_at text not null,
        upsert_count integer not null,
        delete_count integer not null
      );
      create table product_upserts (${PRODUCT_COLUMNS.join(' text, ')} text);
      create table product_deletes (code text primary key);
    `);

    db.query(
      `insert into patch_meta (from_version, to_version, schema_version, generated_at, upsert_count, delete_count)
       values (?, ?, ?, ?, ?, ?)`,
    ).run(
      fromVersion,
      toVersion,
      schemaVersion,
      new Date().toISOString(),
      patch.upserts.length,
      patch.deletes.length,
    );

    const insertUpsert = db.query(
      `insert into product_upserts (${PRODUCT_COLUMNS.join(', ')}) values (${PRODUCT_COLUMNS.map(() => '?').join(', ')})`,
    );
    for (const product of patch.upserts) {
      insertUpsert.run(...PRODUCT_COLUMNS.map((col) => product[col]));
    }

    const insertDelete = db.query('insert into product_deletes (code) values (?)');
    for (const code of patch.deletes) {
      insertDelete.run(code);
    }
  } finally {
    db.close();
  }
}

export function readPatchDb(
  dbPath: string,
): DumpPatch & { fromVersion: string; toVersion: string } {
  const db = new Database(dbPath, { readonly: true });
  try {
    const meta = db
      .query<{ from_version: string; to_version: string }>(
        'select from_version, to_version from patch_meta limit 1',
      )
      .get();
    if (!meta) throw new Error(`${dbPath}: patch_meta ist leer.`);

    const upserts = db
      .query<PatchProductRecord>(`select ${PRODUCT_COLUMNS.join(', ')} from product_upserts`)
      .all();
    const deletes = db
      .query<{ code: string }>('select code from product_deletes')
      .all()
      .map((r) => r.code);

    return { fromVersion: meta.from_version, toVersion: meta.to_version, upserts, deletes };
  } finally {
    db.close();
  }
}
