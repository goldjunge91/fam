#!/usr/bin/env bun
/**
 * evaluate-categories.ts — Dump-Kalibrierung für die Kategorie-Klassifikation
 * (#223 Paket 1, Abschnitt 15 in `docs/issue#223_V2.md`).
 *
 *   bun run evaluate-categories
 *
 * Läuft mit `classifyCategory()` (produktive Engine, keine Zweitimplementierung,
 * siehe `evaluate-categories-core.ts`) über den kompletten lokalen Dump
 * (`products_de.db`) und schreibt einen JSON- und einen HTML-Report daneben.
 *
 * Der Dump ist aktuell noch Schema 1 (kein `categories_tags`, siehe
 * `openfoodfacts.sql`) — nur der Namens-Fallback wird hier geprüft. Sobald
 * `off-dump-v2.db` (#223 Paket 4) existiert, liest dieses Skript dessen
 * `categories_tags`-Spalte automatisch mit (siehe `readDumpProducts` unten)
 * und die OFF-Tag-Metriken füllen sich von selbst.
 */

import { Database } from 'bun:sqlite';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { CATEGORY_GOLDEN_CORPUS } from './category-golden-corpus';
import {
  ALL_SHOPPING_CATEGORY_IDS,
  type CalibrationReport,
  type DumpProductInput,
  evaluateDump,
} from './evaluate-categories-core';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const DUMP_PATH = path.join(SCRIPT_DIR, 'products_de.db');
const JSON_REPORT_PATH = path.join(SCRIPT_DIR, 'category-calibration-report.json');
const HTML_REPORT_PATH = path.join(SCRIPT_DIR, 'category-calibration-report.html');

function hasColumn(db: Database, table: string, column: string): boolean {
  const columns = db.query(`pragma table_info(${table})`).all() as { name: string }[];
  return columns.some((c) => c.name === column);
}

/**
 * Liest alle Produkte aus dem angehängten Dump. Erkennt automatisch, ob
 * `categories_tags` existiert (Schema 2, #223 Paket 4) — solange nicht, liefert
 * jedes Produkt ein leeres `categoryTags`-Array statt zu crashen.
 */
function readDumpProducts(db: Database): DumpProductInput[] {
  const hasCategoryTags = hasColumn(db, 'products', 'categories_tags');
  const rows = db
    .query(
      hasCategoryTags
        ? 'select code, product_name, categories_tags from products'
        : 'select code, product_name from products',
    )
    .all() as { code: string | null; product_name: string; categories_tags?: string | null }[];

  return rows
    .filter((row) => row.product_name && row.product_name.trim().length > 0)
    .map((row) => ({
      barcode: row.code ?? '',
      name: row.product_name,
      categoryTags: row.categories_tags ? JSON.parse(row.categories_tags) : [],
    }));
}

function formatPercent(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function renderHtmlReport(report: CalibrationReport, dumpHasCategoryTags: boolean): string {
  const categoryRows = ALL_SHOPPING_CATEGORY_IDS.map((id) => {
    const count = report.categoryDistribution[id];
    const share = report.totalProducts > 0 ? count / report.totalProducts : 0;
    return `<tr><td>${id}</td><td>${count}</td><td>${formatPercent(share)}</td></tr>`;
  }).join('\n');

  const goldenRows = report.golden.failed
    .map(
      (f) =>
        `<tr><td>${f.name}</td><td>${f.expected ?? 'Sonstiges'}</td><td>${
          f.actual ?? 'Sonstiges'
        }</td><td>${f.note ?? ''}</td></tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Kategorie-Kalibrierung #223</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
  table { border-collapse: collapse; margin: 1rem 0; width: 100%; max-width: 800px; }
  th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; font-size: 0.9rem; }
  th { background: #f0f0f0; }
  .warn { color: #a15c00; background: #fff6e5; padding: 0.75rem 1rem; border-radius: 4px; }
  .ok { color: #0a6b2f; }
  .fail { color: #b3261e; }
</style>
</head>
<body>
<h1>Kategorie-Kalibrierung (#223)</h1>
<p>Classifier-Version: <strong>${report.classifierVersion}</strong> · Produkte insgesamt: <strong>${report.totalProducts}</strong></p>

${
  dumpHasCategoryTags
    ? ''
    : `<p class="warn">Dump ist noch Schema 1 (kein <code>categories_tags</code>) — nur der
       Namens-Fallback wurde geprüft. OFF-Tag-Konflikte und der Live-/Dump-Vergleich
       derselben EAN sind erst ab #223 Paket 4 (Dump Schema 2) auswertbar.</p>`
}

<h2>Abdeckung</h2>
<ul>
  <li>Sonstiges (kein Signal): ${report.sonstigesCount} (${formatPercent(report.sonstigesShare)})</li>
  <li>Quelle OFF-Taxonomie: ${report.sourceCounts.off_taxonomy}</li>
  <li>Quelle Namens-Fallback: ${report.sourceCounts.name_fallback}</li>
  <li>Ohne Treffer: ${report.sourceCounts.none}</li>
</ul>

<h2>Verteilung je Kategorie</h2>
<table>
<tr><th>Kategorie</th><th>Anzahl</th><th>Anteil</th></tr>
${categoryRows}
</table>

<h2>Golden-Korpus</h2>
<p class="${report.golden.passedCount === report.golden.total ? 'ok' : 'fail'}">
  ${report.golden.passedCount} / ${report.golden.total} bestanden
</p>
${
  report.golden.failed.length > 0
    ? `<table><tr><th>Name</th><th>Soll</th><th>Ist</th><th>Hinweis</th></tr>${goldenRows}</table>`
    : '<p class="ok">Keine Abweichungen.</p>'
}

<h2>Stichproben je Kategorie</h2>
<p>Bis zu 100 deterministisch (Hash-basiert) gewählte Beispiele je Kategorie — siehe
<code>category-calibration-report.json</code> für die vollständige Liste.</p>

</body>
</html>
`;
}

function main() {
  if (!existsSync(DUMP_PATH)) {
    console.error(
      `Dump nicht gefunden: ${DUMP_PATH}\nErst 'python3 scripts/dump_data/create_custom_dump.py' ausführen.`,
    );
    process.exit(1);
  }

  const db = new Database(DUMP_PATH, { readonly: true });
  const dumpHasCategoryTags = hasColumn(db, 'products', 'categories_tags');
  const products = readDumpProducts(db);
  db.close();

  const report = evaluateDump(products, CATEGORY_GOLDEN_CORPUS);

  writeFileSync(JSON_REPORT_PATH, JSON.stringify(report, null, 2));
  writeFileSync(HTML_REPORT_PATH, renderHtmlReport(report, dumpHasCategoryTags));

  console.log(`Produkte klassifiziert: ${report.totalProducts}`);
  console.log(`Sonstiges: ${report.sonstigesCount} (${formatPercent(report.sonstigesShare)})`);
  console.log(`Golden-Korpus: ${report.golden.passedCount} / ${report.golden.total} bestanden`);
  if (report.golden.failed.length > 0) {
    console.log('\nAbweichungen:');
    for (const f of report.golden.failed) {
      console.log(
        `  "${f.name}": erwartet ${f.expected ?? 'Sonstiges'}, erhalten ${f.actual ?? 'Sonstiges'}`,
      );
    }
  }
  console.log(`\nReports geschrieben:\n  ${JSON_REPORT_PATH}\n  ${HTML_REPORT_PATH}`);

  if (report.golden.failed.length > 0) process.exit(1);
}

main();
