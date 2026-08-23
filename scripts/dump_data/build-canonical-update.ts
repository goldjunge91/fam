#!/usr/bin/env bun
/**
 * Erzeugt aus neuem Extrakt und optionaler kanonischer DB den naechsten Patch,
 * eine faellige Baseline und das Manifest. Ohne alten Stand entsteht die erste Baseline.
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
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

function versionSlug(isoVersion: string): string {
  return isoVersion.replace(/[^0-9A-Za-z-]/g, '-').replace(/-+/g, '-');
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function assetOf(baseUrl: string, filePath: string) {
  return {
    url: `${baseUrl.replace(/\/$/, '')}/${path.basename(filePath)}`,
    size: statSync(filePath).size,
    sha256: sha256File(filePath),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const newExtractPath = args['new-extract'];
  const outDir = args['out-dir'];
  const baseUrl = args['base-url'];

  if (!newExtractPath || !outDir || !baseUrl) {
    console.error(
      'Nutzung: bun run scripts/dump_data/build-canonical-update.ts --new-extract <db> --out-dir <dir> --base-url <url> [--old-canonical <db>] [--previous-manifest <json>]',
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

  const oldProducts =
    oldCanonicalPath && existsSync(oldCanonicalPath) ? readProducts(oldCanonicalPath) : [];

  mkdirSync(outDir, { recursive: true });

  const isNewBaseline = isNewBaselineDue(
    previousManifest?.baseline.version ?? null,
    newMeta.dataVersion,
  );

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
