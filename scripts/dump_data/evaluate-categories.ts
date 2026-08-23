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

import type { ShoppingCategoryId } from '@/features/shopping-list/classification/shopping-category-id';
import { SHOPPING_CATEGORIES } from '@/features/shopping-list/domain-logik/shopping-categories';
import { CATEGORY_GOLDEN_CORPUS } from './category-golden-corpus';
import {
  type CalibrationReport,
  type CategorySample,
  type DumpProductInput,
  evaluateDump,
} from './evaluate-categories-core';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const DEFAULT_DUMP_PATH = path.join(SCRIPT_DIR, 'products_de.db');
const VOLUMES_DUMP_PATH = '/Volumes/Programme/off-dump-data/products_de.db';

function resolveDumpPath(): string {
  const customArg = process.argv[2];
  if (customArg) return path.resolve(customArg);
  if (process.env.OFF_DUMP_PATH) return path.resolve(process.env.OFF_DUMP_PATH);
  if (existsSync(VOLUMES_DUMP_PATH)) return VOLUMES_DUMP_PATH;
  return DEFAULT_DUMP_PATH;
}

const DUMP_PATH = resolveDumpPath();
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

function getCategoryZone(sortOrder: number): string {
  if (sortOrder <= 30) return 'Frische & Eingang';
  if (sortOrder <= 100) return 'Mittelgänge (Trocken)';
  if (sortOrder <= 140) return 'Non-Food & Drogerie';
  if (sortOrder <= 190) return 'Frischewand & Molkerei';
  if (sortOrder <= 200) return 'Tiefkühlbereich';
  return 'Kassenzone';
}

function renderHtmlReport(report: CalibrationReport, dumpHasCategoryTags: boolean): string {
  const recognizedCount = report.totalProducts - report.sonstigesCount;
  const recognizedShare = report.totalProducts > 0 ? recognizedCount / report.totalProducts : 0;

  const sortedCategories = [...SHOPPING_CATEGORIES].sort((a, b) => a.sortOrder - b.sortOrder);

  const categoryRows = sortedCategories
    .map((cat) => {
      const catId = cat.id as ShoppingCategoryId;
      const count = report.categoryDistribution[catId] ?? 0;
      const share = report.totalProducts > 0 ? count / report.totalProducts : 0;
      const percentStr = formatPercent(share);
      const zone = getCategoryZone(cat.sortOrder);
      const samples = report.samples[catId] ?? [];
      const samplePreview = samples
        .map(
          (s: CategorySample) =>
            `<li style="margin-bottom:2px;"><code>${s.barcode || '—'}</code> ${escapeHtml(s.name)}</li>`,
        )
        .join('');

      return `<tr>
      <td style="text-align:center; font-weight:600; color:#666;">${cat.sortOrder}</td>
      <td style="font-size:0.85rem; color:#555;">${zone}</td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:12px; height:12px; border-radius:3px; background:${cat.color};"></span>
          <strong>${cat.label}</strong>
          <span style="font-size:0.75rem; color:#888; background:#f0f0f0; padding:2px 6px; border-radius:4px;">${cat.id}</span>
        </div>
        <div style="font-size:0.8rem; color:#666; margin-top:2px;">
          Bsp: ${cat.keywords.slice(0, 6).join(', ')}...
        </div>
      </td>
      <td style="text-align:right; font-weight:600;">${count.toLocaleString('de-DE')}</td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="flex:1; background:#eee; height:8px; border-radius:4px; overflow:hidden;">
            <div style="width:${(share * 100).toFixed(1)}%; background:${cat.color}; height:100%;"></div>
          </div>
          <span style="font-size:0.85rem; min-width:45px; text-align:right;">${percentStr}</span>
        </div>
      </td>
      <td>
        ${
          samples.length > 0
            ? `<details>
                <summary style="cursor:pointer; font-size:0.8rem; font-weight:600; color:#4a6fa5;">${samples.length.toLocaleString('de-DE')} Stichproben</summary>
                <ul style="margin:6px 0 0 0; padding-left:18px; font-size:0.78rem; max-height:280px; overflow-y:auto; word-break:break-word;">
                  ${samplePreview}
                </ul>
              </details>`
            : '<span style="color:#aaa; font-size:0.8rem;">keine</span>'
        }
      </td>
    </tr>`;
    })
    .join('\n');

  const goldenRows = report.golden.failed
    .map(
      (f) =>
        `<tr>
        <td><strong>${escapeHtml(f.name)}</strong></td>
        <td><span class="badge" style="background:#e8f5e9; color:#2e7d32;">${f.expected ?? 'Sonstiges'}</span></td>
        <td><span class="badge" style="background:#ffebee; color:#c62828;">${f.actual ?? 'Sonstiges'}</span></td>
        <td style="font-size:0.85rem; color:#555;">${escapeHtml(f.note ?? '')}</td>
      </tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Kategorie-Kalibrierung & Dump-Auswertung (#223)</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 2.5rem;
    background: #faf8f6;
    color: #2b2529;
    line-height: 1.5;
  }
  .container { max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 1.8rem; margin-bottom: 0.3rem; color: #1f1a21; }
  .subtitle { color: #6e656d; font-size: 0.95rem; margin-bottom: 2rem; }
  
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .card {
    background: #fff;
    border: 1px solid #ebdcd5;
    border-radius: 10px;
    padding: 1.2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }
  .card-val { font-size: 1.8rem; font-weight: 700; color: #1f1a21; margin: 0.2rem 0; }
  .card-lbl { font-size: 0.82rem; color: #786f79; text-transform: uppercase; letter-spacing: 0.5px; }
  
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: #fff;
    border: 1px solid #ebdcd5;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }
  th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #f2e9e4; }
  th { background: #fbf5f2; font-weight: 600; font-size: 0.85rem; color: #5c535d; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #faf6f4; }
  
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
  .warn-box { background: #fff8e1; border: 1px solid #ffe082; color: #7f6000; padding: 1rem 1.2rem; border-radius: 8px; margin-bottom: 1.5rem; }
  .ok-box { background: #e8f5e9; border: 1px solid #c8e6c9; color: #2e7d32; padding: 1rem 1.2rem; border-radius: 8px; margin-bottom: 1.5rem; }
  code { font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 0.85em; background: #f0ece9; padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
<div class="container">
  <h1>Supermarkt-Laufstrecke & Kategorie-Kalibrierung (#223)</h1>
  <div class="subtitle">
    Classifier-Version: <code>${report.classifierVersion}</code> · 
    Dump-Gesamtdaten: <strong>${report.totalProducts.toLocaleString('de-DE')} Produkte</strong>
  </div>

  ${
    dumpHasCategoryTags
      ? '<div class="ok-box">✅ Dump enthält <code>categories_tags</code> — OFF-Taxonomie und Namens-Fallback werden vollumfänglich ausgewertet.</div>'
      : '<div class="warn-box">⚠️ Dump ist noch Schema 1 (kein <code>categories_tags</code>) — nur der Namens-Fallback wurde geprüft.</div>'
  }

  <div class="grid">
    <div class="card">
      <div class="card-lbl">Klassifiziert</div>
      <div class="card-val">${formatPercent(recognizedShare)}</div>
      <div style="font-size:0.85rem; color:#4caf50;">${recognizedCount.toLocaleString('de-DE')} Artikel</div>
    </div>
    <div class="card">
      <div class="card-lbl">Sonstiges / Nicht erkannt</div>
      <div class="card-val">${formatPercent(report.sonstigesShare)}</div>
      <div style="font-size:0.85rem; color:#888;">${report.sonstigesCount.toLocaleString('de-DE')} Artikel</div>
    </div>
    <div class="card">
      <div class="card-lbl">Erkennungs-Quellen</div>
      <div style="font-size:0.9rem; margin-top:6px;">
        <div>OFF-Tags: <strong>${report.sourceCounts.off_taxonomy.toLocaleString('de-DE')}</strong></div>
        <div>Name-Fallback: <strong>${report.sourceCounts.name_fallback.toLocaleString('de-DE')}</strong></div>
      </div>
    </div>
    <div class="card">
      <div class="card-lbl">Golden-Korpus Validierung</div>
      <div class="card-val" style="color:${report.golden.passedCount === report.golden.total ? '#2e7d32' : '#c62828'};">
        ${report.golden.passedCount} / ${report.golden.total}
      </div>
      <div style="font-size:0.85rem; color:#666;">Regressionstests bestanden</div>
    </div>
  </div>

  <h2>Kategorie-Verteilung entlang der Supermarkt-Laufstrecke (21 Zonen)</h2>
  <table>
    <thead>
      <tr>
        <th style="width:50px; text-align:center;">Rang</th>
        <th style="width:160px;">Supermarkt-Zone</th>
        <th>Kategorie & Typische Artikel</th>
        <th style="text-align:right; width:100px;">Anzahl</th>
        <th style="width:200px;">Anteil</th>
        <th style="min-width:280px;">Stichproben</th>
      </tr>
    </thead>
    <tbody>
      ${categoryRows}
    </tbody>
  </table>

  <h2>Golden-Korpus Qualitätsprüfung</h2>
  ${
    report.golden.failed.length > 0
      ? `<table>
          <thead>
            <tr><th>Artikelname</th><th>Erwartet</th><th>Erhalten</th><th>Hinweis / Grund</th></tr>
          </thead>
          <tbody>${goldenRows}</tbody>
        </table>`
      : '<div class="ok-box">✅ Alle Referenz- und Kollisionsfälle des Golden-Korpus wurden fehlerfrei erkannt!</div>'
  }
</div>
</body>
</html>
`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

  const sampleSize = process.env.SAMPLE_SIZE
    ? Number.parseInt(process.env.SAMPLE_SIZE, 10)
    : undefined;
  const report = evaluateDump(products, CATEGORY_GOLDEN_CORPUS, sampleSize);

  writeFileSync(JSON_REPORT_PATH, JSON.stringify(report, null, 2));
  writeFileSync(HTML_REPORT_PATH, renderHtmlReport(report, dumpHasCategoryTags));

  console.log(`Dump geladen von: ${DUMP_PATH}`);
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
