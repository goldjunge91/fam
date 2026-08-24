/**
 * Sicherer Baseline-Wechsel (#223 Paket 6, Abschnitt 14 "Sicherer
 * Baseline-Wechsel"). Die aktive Datei wird nie direkt überschrieben:
 * Download nach `next`, Prüfsumme + Schema + `quick_check` verifizieren,
 * dann erst der eigentliche Wechsel (alte Datei -> recovery, next -> active,
 * neu attachen, recovery erst danach entfernen).
 *
 * Nutzt `reconcileBaselineState()` bewusst NICHT selbst — das ist die
 * Aufräumlogik für einen bereits inkonsistenten Zustand beim App-Start
 * (siehe `repository.ts`), dieser Installer erzeugt den Zustandswechsel
 * unter normalen Bedingungen.
 */

import type { SqlDatabase } from '@/lib/db/types';
import type { FileOps } from './file-ops';

export type InstallBaselineResult =
  | { ok: true; dataVersion: string }
  | { ok: false; reason: 'checksum_mismatch' | 'schema_mismatch' | 'corrupted' };

function escapePathForSql(path: string): string {
  return path.replace(/'/g, "''");
}

/** Detacht `off_dump`, falls angehängt — kein Fehler, wenn es das nicht ist. */
async function detachOffDumpIfAttached(db: SqlDatabase): Promise<void> {
  try {
    await db.execAsync('DETACH DATABASE off_dump');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('no such database')) throw err;
  }
}

export async function installBaseline(
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
): Promise<InstallBaselineResult> {
  const {
    downloadUrl,
    expectedChecksum,
    expectedSchemaVersion,
    activePath,
    nextPath,
    recoveryPath,
  } = params;

  // 1. Download nach `next` (nie direkt in die aktive Datei).
  await fileOps.download(downloadUrl, nextPath);

  // 2. Prüfsumme.
  const actualChecksum = await fileOps.checksum(nextPath);
  if (actualChecksum !== expectedChecksum) {
    await fileOps.delete(nextPath);
    return { ok: false, reason: 'checksum_mismatch' };
  }

  // 3+4. Schema/data_version + PRAGMA quick_check, unabhängig von der
  // Hauptverbindung geöffnet.
  const inspected = await fileOps.inspectDump(nextPath);
  if (!inspected || inspected.schemaVersion !== expectedSchemaVersion) {
    await fileOps.delete(nextPath);
    return { ok: false, reason: 'schema_mismatch' };
  }
  if (!inspected.integrityOk) {
    await fileOps.delete(nextPath);
    return { ok: false, reason: 'corrupted' };
  }

  // 5+6. Zugriffe serialisieren (Aufrufer hält die Verbindung exklusiv,
  // solange dieser Aufruf läuft), alten Dump detachen.
  await detachOffDumpIfAttached(db);

  // 7. Aktive Datei (falls vorhanden) zu recovery umbenennen.
  if (await fileOps.exists(activePath)) {
    await fileOps.move(activePath, recoveryPath);
  }

  // 8. Neue Datei atomar aktivieren.
  await fileOps.move(nextPath, activePath);

  // 9. Neue Datei attachen.
  await db.execAsync(`ATTACH DATABASE '${escapePathForSql(activePath)}' AS off_dump`);

  // 10. Recovery-Datei erst NACH erfolgreichem Attach entfernen.
  if (await fileOps.exists(recoveryPath)) {
    await fileOps.delete(recoveryPath);
  }

  return { ok: true, dataVersion: inspected.dataVersion };
}
