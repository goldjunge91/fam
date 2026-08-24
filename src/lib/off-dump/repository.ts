/**
 * Orchestrierung des Client-Dump-Updaters (#223 Paket 6, Abschnitt 14
 * "Normaler Start"/"Entscheidung Patch oder Baseline"). Führt
 * manifest.ts, update-planner.ts, patch-applier.ts und
 * baseline-installer.ts zu den beiden öffentlichen Abläufen zusammen:
 * `reconcileOnStart()` (Absturzbereinigung vor jedem Attach) und
 * `checkForUpdate()` (Hintergrund-Update-Check). Reine Verdrahtung — die
 * eigentliche Entscheidungs-/Anwendungslogik ist bereits in den einzelnen
 * Modulen getestet, hier zählt der Ablauf (deshalb DI'd statt echtem I/O
 * in den Tests).
 */

import type { SqlDatabase } from '@/lib/db/types';
import { type InstallBaselineResult, installBaseline } from './baseline-installer';
import { reconcileBaselineState } from './baseline-reconcile';
import type { FileOps } from './file-ops';
import { type DumpManifest, fetchManifest as defaultFetchManifest } from './manifest';
import { type ApplyPatchResult, applyPatch } from './patch-applier';
import { planUpdate } from './update-planner';

export type DumpPaths = { activePath: string; nextPath: string; recoveryPath: string };

export type UpdateOutcome =
  | { kind: 'up-to-date' }
  | { kind: 'manifest-unavailable' }
  | { kind: 'patched'; dataVersion: string }
  | { kind: 'baseline-installed'; dataVersion: string }
  | { kind: 'baseline-failed' };

type InstallBaselineFn = (
  db: SqlDatabase,
  fileOps: FileOps,
  params: {
    downloadUrl: string;
    expectedChecksum: string;
    expectedSchemaVersion: number;
    activePath: string;
    nextPath: string;
    recoveryPath: string;
  },
) => Promise<InstallBaselineResult>;

type ApplyPatchFn = (
  db: SqlDatabase,
  params: {
    patchDbPath: string;
    expectedFromVersion: string;
    expectedSchemaVersion: number;
    toVersion: string;
  },
) => Promise<ApplyPatchResult>;

/**
 * Vor jedem Attach: bereinigt einen ggf. inkonsistenten Dateizustand vom
 * letzten Absturz (siehe `baseline-reconcile.ts`).
 */
export async function reconcileOnStart(fileOps: FileOps, paths: DumpPaths): Promise<void> {
  const [active, next, recovery] = await Promise.all([
    fileOps.exists(paths.activePath),
    fileOps.exists(paths.nextPath),
    fileOps.exists(paths.recoveryPath),
  ]);

  const actions = reconcileBaselineState({ active, next, recovery });
  for (const action of actions) {
    if (action.kind === 'move') {
      const from = action.from === 'next' ? paths.nextPath : paths.recoveryPath;
      await fileOps.move(from, paths.activePath);
    } else {
      const file = action.file === 'next' ? paths.nextPath : paths.recoveryPath;
      await fileOps.delete(file);
    }
  }
}

/**
 * Wendet die Patchkette der Reihe nach an. Bricht bei der ersten Ablehnung
 * (from_version/schema_mismatch) sofort ab, statt in einem halb
 * angewendeten Zustand weiterzumachen — der Aufrufer faellt dann auf eine
 * neue Baseline zurueck.
 */
async function applyPatchChain(
  db: SqlDatabase,
  fileOps: FileOps,
  manifest: DumpManifest,
  patches: DumpManifest['patches'],
  paths: DumpPaths,
  applyPatchFn: ApplyPatchFn,
): Promise<{ ok: true } | { ok: false }> {
  for (const patch of patches) {
    await fileOps.download(patch.url, paths.nextPath);
    try {
      const result = await applyPatchFn(db, {
        patchDbPath: paths.nextPath,
        expectedFromVersion: patch.from,
        expectedSchemaVersion: manifest.schemaVersion,
        toVersion: patch.to,
      });
      if (!result.ok) return { ok: false };
    } finally {
      await fileOps.delete(paths.nextPath);
    }
  }
  return { ok: true };
}

export async function checkForUpdate(params: {
  db: SqlDatabase;
  fileOps: FileOps;
  manifestUrl: string;
  paths: DumpPaths;
  fetchManifest?: (url: string) => Promise<DumpManifest | null>;
  installBaseline?: InstallBaselineFn;
  applyPatch?: ApplyPatchFn;
}): Promise<UpdateOutcome> {
  const {
    db,
    fileOps,
    manifestUrl,
    paths,
    fetchManifest: fetchManifestFn = defaultFetchManifest,
    installBaseline: installBaselineFn = installBaseline,
    applyPatch: applyPatchFn = applyPatch,
  } = params;

  const manifest = await fetchManifestFn(manifestUrl);
  if (!manifest) return { kind: 'manifest-unavailable' };

  const inspected = await fileOps.inspectDump(paths.activePath);
  const plan = planUpdate(
    {
      schemaVersion: inspected?.schemaVersion ?? null,
      dataVersion: inspected?.dataVersion ?? null,
      integrityOk: inspected?.integrityOk ?? false,
    },
    manifest,
  );

  const baseline = manifest.baseline;
  const schemaVersion = manifest.schemaVersion;

  async function runBaselineInstall(): Promise<UpdateOutcome> {
    const result = await installBaselineFn(db, fileOps, {
      downloadUrl: baseline.url,
      expectedChecksum: baseline.checksum,
      expectedSchemaVersion: schemaVersion,
      activePath: paths.activePath,
      nextPath: paths.nextPath,
      recoveryPath: paths.recoveryPath,
    });
    return result.ok
      ? { kind: 'baseline-installed', dataVersion: result.dataVersion }
      : { kind: 'baseline-failed' };
  }

  if (plan.kind === 'up-to-date') return { kind: 'up-to-date' };
  if (plan.kind === 'baseline') return runBaselineInstall();

  const chainResult = await applyPatchChain(
    db,
    fileOps,
    manifest,
    plan.patches,
    paths,
    applyPatchFn,
  );
  if (chainResult.ok) return { kind: 'patched', dataVersion: manifest.latestVersion };

  // Ein abgelehnter Patch mitten in der Kette: nicht in einem halb
  // angewendeten Zustand steckenbleiben, stattdessen frische Baseline.
  return runBaselineInstall();
}
