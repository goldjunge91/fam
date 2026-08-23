/**
 * SQLite-Ein-/Ausgabe für die CI-Delta-Pipeline (#223 Paket 5) — bewusst von
 * `dump-patch-core.ts`/`dump-manifest-core.ts` getrennt: jene bleiben reine,
 * ohne Dateisystem testbare Funktionen; dieses Modul kapselt den einzigen
 * Kontaktpunkt zu `bun:sqlite`.
 */

import { Database } from 'bun:sqlite';
import type { DumpPatch, PatchProductRecord } from './dump-patch-core';

const PRODUCT_TEXT_COLUMNS = [
  'code',
  'product_name',
  'brand',
  'quantity',
  'stores',
  'nutriscore',
  'categories_tags',
  'off_last_modified_at',
] as const;

/** Nährwerte pro 100g/100ml — müssen `real` sein, sonst vergleicht `computePatch()` (strikte `===`) Zahl gegen String falsch. */
const PRODUCT_REAL_COLUMNS = [
  'energy_kcal',
  'fat',
  'saturated_fat',
  'carbohydrates',
  'sugars',
  'proteins',
  'salt',
] as const;

export const PRODUCT_COLUMNS: readonly (keyof PatchProductRecord)[] = [
  ...PRODUCT_TEXT_COLUMNS,
  ...PRODUCT_REAL_COLUMNS,
];

export function productColumnDefsSql(): string {
  return [
    ...PRODUCT_TEXT_COLUMNS.map((c) => `${c} text`),
    ...PRODUCT_REAL_COLUMNS.map((c) => `${c} real`),
  ].join(', ');
}

export type DumpMeta = {
  schemaVersion: number;
  dataVersion: string;
  generatedAt: string;
  sourceCursor: string | null;
};

/** Liest alle Produkte aus einer Dump-Schema-2-Datenbank (Baseline oder kanonische DB). */
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

/** `PRAGMA quick_check` — muss vor jeder Veröffentlichung erfolgreich sein (Abschnitt 12/13). */
export function quickCheck(dbPath: string): boolean {
  const db = new Database(dbPath, { readonly: true });
  try {
    const result = db
      .query<{ integrity_check?: string; quick_check?: string }>('PRAGMA quick_check')
      .all();
    // SQLite liefert das Ergebnis unter dem Spaltennamen "quick_check" — je
    // nach Treiberversion manchmal auch generisch. Beide Formen abdecken statt
    // uns auf einen exakten Spaltennamen zu verlassen.
    return result.length === 1 && Object.values(result[0]).some((v) => v === 'ok');
  } finally {
    db.close();
  }
}

/**
 * Schreibt eine Patch-Datenbank (`patch_meta`, `product_upserts`,
 * `product_deletes`, Abschnitt 13 "Patch-Datenbank").
 */
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
      create table product_upserts (${productColumnDefsSql()});
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
      insertUpsert.run(...PRODUCT_COLUMNS.map((col) => product[col as keyof PatchProductRecord]));
    }

    const insertDelete = db.query('insert into product_deletes (code) values (?)');
    for (const code of patch.deletes) {
      insertDelete.run(code);
    }
  } finally {
    db.close();
  }
}

/** Liest eine Patch-Datenbank zurück in ein `DumpPatch` (für Rekonstruktion). */
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
