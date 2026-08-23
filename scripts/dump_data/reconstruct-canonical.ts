#!/usr/bin/env bun
/**
 * reconstruct-canonical.ts — deterministische Rekonstruktion der kanonischen
 * DB aus einer Baseline und der vollständigen Patchkette (#223 Paket 5,
 * Abschnitt 13 "Dauerhafte kanonische CI-Datenbank": "Fehlt oder scheitert
 * die kanonische DB, rekonstruiert der Workflow sie deterministisch aus der
 * aktuellen Monats-Baseline und der vollständigen Patchkette.").
 *
 *   bun run scripts/dump_data/reconstruct-canonical.ts \
 *     --baseline baseline-2026-08-01.db \
 *     --patches patch-2026-08-01-2026-08-02.db patch-2026-08-02-2026-08-03.db \
 *     --out canonical.db \
 *     [--expect-data-version 2026-08-03]
 *
 * Patches müssen in Reihenfolge übergeben werden (from -> to der Kette).
 * Prüft nach dem Zusammenbau `PRAGMA quick_check` und optional die erwartete
 * `data_version` — beides muss erfolgreich sein, sonst bricht der Prozess
 * mit exit 1 ab statt eine unsichere Datei zu veröffentlichen.
 */

import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import { reconstructCanonical } from './dump-patch-core';
import { quickCheck, readDumpMeta, readPatchDb, readProducts } from './dump-sqlite-io';

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

function parseArgs(argv: string[]): {
  baseline?: string;
  patches: string[];
  out?: string;
  expectDataVersion?: string;
} {
  const result: { baseline?: string; patches: string[]; out?: string; expectDataVersion?: string } =
    {
      patches: [],
    };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--baseline') result.baseline = argv[++i];
    else if (arg === '--out') result.out = argv[++i];
    else if (arg === '--expect-data-version') result.expectDataVersion = argv[++i];
    else if (arg === '--patches') {
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) result.patches.push(argv[++i]);
    }
  }
  return result;
}

function writeCanonicalDb(
  outPath: string,
  products: readonly Record<string, unknown>[],
  meta: {
    schemaVersion: number;
    dataVersion: string;
    generatedAt: string;
    sourceCursor: string | null;
  },
) {
  const db = new Database(outPath, { create: true });
  try {
    db.exec('PRAGMA journal_mode = MEMORY;');
    db.exec(`
      create table products (${PRODUCT_COLUMNS.join(' text, ')} text);
      create table dump_meta (
        schema_version integer not null,
        data_version text not null,
        generated_at text not null,
        source_cursor text
      );
      create index idx_product_name on products(product_name);
      create index idx_brand on products(brand);
    `);

    const insert = db.query(
      `insert into products (${PRODUCT_COLUMNS.join(', ')}) values (${PRODUCT_COLUMNS.map(() => '?').join(', ')})`,
    );
    for (const product of products) {
      insert.run(...PRODUCT_COLUMNS.map((col) => (product as Record<string, unknown>)[col]));
    }

    db.query(
      'insert into dump_meta (schema_version, data_version, generated_at, source_cursor) values (?, ?, ?, ?)',
    ).run(meta.schemaVersion, meta.dataVersion, meta.generatedAt, meta.sourceCursor);
  } finally {
    db.close();
  }
}

function main() {
  const { baseline, patches, out, expectDataVersion } = parseArgs(process.argv.slice(2));

  if (!baseline || !out) {
    console.error(
      'Nutzung: bun run scripts/dump_data/reconstruct-canonical.ts --baseline <db> --patches <db...> --out <db> [--expect-data-version <v>]',
    );
    process.exit(1);
  }
  if (!existsSync(baseline)) {
    console.error(`Baseline nicht gefunden: ${baseline}`);
    process.exit(1);
  }

  const baselineMeta = readDumpMeta(baseline);
  const baselineProducts = readProducts(baseline);

  const patchRecords = patches.map((patchPath) => {
    if (!existsSync(patchPath)) {
      console.error(`Patch nicht gefunden: ${patchPath}`);
      process.exit(1);
    }
    return readPatchDb(patchPath);
  });

  // Kette validieren: jeder Patch muss lückenlos an den vorherigen anschließen.
  let expectedFrom = baselineMeta.dataVersion;
  for (const patch of patchRecords) {
    if (patch.fromVersion !== expectedFrom) {
      console.error(
        `Patchkette unterbrochen: erwartet from=${expectedFrom}, aber ${patch.fromVersion} in der übergebenen Reihenfolge.`,
      );
      process.exit(1);
    }
    expectedFrom = patch.toVersion;
  }

  const reconstructed = reconstructCanonical(baselineProducts, patchRecords);
  const finalDataVersion =
    patchRecords.length > 0
      ? patchRecords[patchRecords.length - 1].toVersion
      : baselineMeta.dataVersion;

  writeCanonicalDb(out, reconstructed, {
    schemaVersion: baselineMeta.schemaVersion,
    dataVersion: finalDataVersion,
    generatedAt: new Date().toISOString(),
    sourceCursor: null,
  });

  if (!quickCheck(out)) {
    console.error(`FEHLER: quick_check für rekonstruierte Datei ${out} fehlgeschlagen.`);
    process.exit(1);
  }

  if (expectDataVersion && expectDataVersion !== finalDataVersion) {
    console.error(
      `FEHLER: rekonstruierte data_version (${finalDataVersion}) weicht von der erwarteten (${expectDataVersion}) ab.`,
    );
    process.exit(1);
  }

  console.log(
    `Rekonstruktion erfolgreich: ${reconstructed.length} Produkte, data_version=${finalDataVersion}.`,
  );
  console.log('quick_check: ok.');
}

main();
