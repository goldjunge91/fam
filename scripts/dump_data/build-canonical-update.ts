#!/usr/bin/env bun
/**
 * build-canonical-update.ts — CI-Delta-Pipeline für den Offline-Dump (#223
 * Paket 5, Abschnitt 13 in `docs/issue#223_V2.md`).
 *
 * Nimmt den frisch von `create_custom_dump.py` erzeugten vollständigen
 * Deutschland-Katalog (Schema 2) entgegen, vergleicht ihn mit der zuletzt
 * veröffentlichten kanonischen DB und erzeugt daraus:
 * - eine aktualisierte kanonische DB (`canonical.db`),
 * - bei einem regulären Lauf einen Patch (`patch-<from>-<to>.db`),
 * - bei einem fälligen monatlichen Baseline-Schnitt eine versionierte
 *   Baseline-Datei (`baseline-<version>.db`),
 * - ein aktualisiertes `manifest.json`.
 *
 * Reine Datei-Ein-/Ausgabe + Orchestrierung — die eigentliche Diff-/
 * Manifest-Logik steckt testbar in `dump-patch-core.ts`/`dump-manifest-core.ts`.
 *
 *   bun run scripts/dump_data/build-canonical-update.ts \
 *     --new-extract products_de.db \
 *     --old-canonical canonical.db \
 *     --previous-manifest manifest.json \
 *     --base-url https://github.com/goldjunge91/fam/releases/download/off-dump-current \
 *     --out-dir out/
 *
 * `--old-canonical`/`--previous-manifest` weglassen für den allerersten Lauf
 * (erzeugt automatisch eine neue Baseline).
 *
 * `--force-baseline` erzwingt einen Baseline-Schnitt unabhängig vom
 * Monats-Gate (`isNewBaselineDue()`) — Reparaturweg, falls die aktuell
 * veröffentlichte Baseline mit einem inkompatiblen Client nicht mehr
 * verifizierbar ist (z. B. Prüfsummen-Algorithmus-Wechsel im Client, ohne
 * dass zufällig ein Kalendermonat-Wechsel ansteht).
 */

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { buildNextManifest, type DumpManifest, isNewBaselineDue } from './dump-manifest-core';
import { computePatch } from './dump-patch-core';
import { quickCheck, readDumpMeta, readProducts, writePatchDb } from './dump-sqlite-io';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      // Boolescher Flag statt Key/Value-Paar, wenn kein Wert folgt oder der
      // naechste Token selbst wieder ein Flag ist (z.B. "--force-baseline
      // --new-extract ..." statt "--force-baseline true").
      if (next === undefined || next.startsWith('--')) {
        args[key] = 'true';
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

/** Dateinamensicherer Ausschnitt einer ISO-Version, z.B. "2026-08-23T05-34-12". */
function versionSlug(isoVersion: string): string {
  return isoVersion.replace(/[^0-9A-Za-z-]/g, '-').replace(/-+/g, '-');
}

function checksumFile(filePath: string): string {
  return createHash('md5').update(readFileSync(filePath)).digest('hex');
}

function assetOf(baseUrl: string, filePath: string) {
  return {
    url: `${baseUrl.replace(/\/$/, '')}/${path.basename(filePath)}`,
    size: statSync(filePath).size,
    checksum: checksumFile(filePath),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const newExtractPath = args['new-extract'];
  const outDir = args['out-dir'];
  const baseUrl = args['base-url'];

  if (!newExtractPath || !outDir || !baseUrl) {
    console.error(
      'Nutzung: bun run scripts/dump_data/build-canonical-update.ts --new-extract <db> --out-dir <dir> --base-url <url> [--old-canonical <db>] [--previous-manifest <json>] [--force-baseline]',
    );
    process.exit(1);
  }

  if (!quickCheck(newExtractPath)) {
    console.error(`FEHLER: quick_check für ${newExtractPath} fehlgeschlagen — Abbruch.`);
    process.exit(1);
  }

  const newMeta = readDumpMeta(newExtractPath);
  const newProducts = readProducts(newExtractPath);

  const oldCanonicalPath = args['old-canonical'];
  const previousManifestPath = args['previous-manifest'];

  const previousManifest: DumpManifest | null =
    previousManifestPath && existsSync(previousManifestPath)
      ? JSON.parse(readFileSync(previousManifestPath, 'utf-8'))
      : null;

  mkdirSync(outDir, { recursive: true });

  const isNewBaseline =
    args['force-baseline'] === 'true' ||
    isNewBaselineDue(previousManifest?.baseline.version ?? null, newMeta.dataVersion);

  // Nur fuer den Patch-Pfad noetig — bei einer neuen Baseline wird kein Diff
  // gerechnet, und die alte kanonische DB kann (z.B. bei --force-baseline
  // wegen eines Schema-Sprungs) ein aelteres, inkompatibles Spaltenschema
  // haben. `readProducts()` waere dort ein harter Fehlschlag statt eines
  // harmlosen, ungenutzten Werts.
  const oldProducts =
    !isNewBaseline && oldCanonicalPath && existsSync(oldCanonicalPath)
      ? readProducts(oldCanonicalPath)
      : [];

  const canonicalOutPath = path.join(outDir, 'canonical.db');
  copyFileSync(newExtractPath, canonicalOutPath);

  let patchEntry: ReturnType<typeof buildPatchEntry> | null = null;
  let baselineOutPath: string | null = null;

  if (isNewBaseline) {
    baselineOutPath = path.join(outDir, `baseline-${versionSlug(newMeta.dataVersion)}.db`);
    copyFileSync(newExtractPath, baselineOutPath);
  } else {
    const fromVersion = previousManifest?.latestVersion;
    if (!fromVersion) {
      throw new Error(
        'isNewBaseline=false setzt ein vorhandenes --previous-manifest mit latestVersion voraus.',
      );
    }
    const patch = computePatch(oldProducts, newProducts);
    const patchOutPath = path.join(
      outDir,
      `patch-${versionSlug(fromVersion)}-${versionSlug(newMeta.dataVersion)}.db`,
    );
    writePatchDb(patchOutPath, {
      fromVersion,
      toVersion: newMeta.dataVersion,
      schemaVersion: newMeta.schemaVersion,
      patch,
    });
    patchEntry = buildPatchEntry(baseUrl, patchOutPath, fromVersion, newMeta.dataVersion, patch);
  }

  const manifest = buildNextManifest({
    previous: previousManifest,
    isNewBaseline,
    schemaVersion: newMeta.schemaVersion,
    dataVersion: newMeta.dataVersion,
    baselineAsset: isNewBaseline
      ? assetOf(baseUrl, baselineOutPath as string)
      : (previousManifest as DumpManifest).baseline,
    patchEntry,
  });

  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(isNewBaseline ? 'Neue Baseline geschnitten.' : 'Patch erzeugt.');
  console.log(`data_version: ${newMeta.dataVersion}`);
  console.log(`Produkte gesamt: ${newProducts.length}`);
  if (patchEntry) console.log(`Upserts: ${patchEntry.upserts}, Deletes: ${patchEntry.deletes}`);
  console.log(`Geschrieben nach: ${outDir}`);
}

function buildPatchEntry(
  baseUrl: string,
  patchOutPath: string,
  fromVersion: string,
  toVersion: string,
  patch: { upserts: unknown[]; deletes: unknown[] },
) {
  return {
    ...assetOf(baseUrl, patchOutPath),
    from: fromVersion,
    to: toVersion,
    upserts: patch.upserts.length,
    deletes: patch.deletes.length,
  };
}

main();
