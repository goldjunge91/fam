import { isSerializedSqlDatabase } from '@/lib/db/serialize';
import type { SqlDatabase } from '@/lib/db/types';
import { type FileOps, throwIfOffDumpAborted } from './file-ops';
import { setOffDumpAttached } from './off-dump-state';
import { attachPlaintextDatabase, type PlaintextAttachmentMode } from './plaintext-attachment';

export type InstallBaselineResult =
  | { ok: true; dataVersion: string }
  | { ok: false; reason: 'checksum_mismatch' | 'schema_mismatch' | 'corrupted' };

type CleanupExec = (source: string) => Promise<void>;

/** Detacht `off_dump`, falls der Alias auf dieser Connection angehängt ist. */
async function detachOffDumpIfAttached(
  db: SqlDatabase,
  cleanupExecAsync: CleanupExec,
  signal?: AbortSignal,
): Promise<void> {
  throwIfOffDumpAborted(signal);
  const attachedDatabases = await db.getAllAsync<{ name: string }>('PRAGMA database_list');
  if (!attachedDatabases.some(({ name }) => name === 'off_dump')) return;

  await cleanupExecAsync('DETACH DATABASE off_dump');
}

async function detachPersistentOffDump(db: SqlDatabase, signal?: AbortSignal): Promise<void> {
  if (isSerializedSqlDatabase(db)) {
    await db.withWriterLeaseAsync(
      'off.baseline.detach',
      ({ db: scopedDb, cleanupExecAsync }) =>
        detachOffDumpIfAttached(scopedDb, cleanupExecAsync, signal),
      signal,
    );
    return;
  }

  await detachOffDumpIfAttached(db, (source) => db.execAsync(source), signal);
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
    attachmentMode: PlaintextAttachmentMode;
    signal?: AbortSignal;
  },
): Promise<InstallBaselineResult> {
  const {
    downloadUrl,
    expectedChecksum,
    expectedSchemaVersion,
    activePath,
    nextPath,
    recoveryPath,
    attachmentMode,
    signal,
  } = params;

  // 1. Download nach `next` (nie direkt in die aktive Datei).
  await fileOps.download(downloadUrl, nextPath, signal);
  throwIfOffDumpAborted(signal);

  // 2. Prüfsumme.
  const actualChecksum = await fileOps.checksum(nextPath);
  throwIfOffDumpAborted(signal);
  if (actualChecksum !== expectedChecksum) {
    await fileOps.delete(nextPath);
    return { ok: false, reason: 'checksum_mismatch' };
  }

  // 3+4. Schema/data_version + PRAGMA quick_check, unabhängig von der
  // Hauptverbindung geöffnet.
  const inspected = await fileOps.inspectDump(nextPath);
  throwIfOffDumpAborted(signal);
  if (!inspected || inspected.schemaVersion !== expectedSchemaVersion) {
    await fileOps.delete(nextPath);
    return { ok: false, reason: 'schema_mismatch' };
  }
  if (!inspected.integrityOk) {
    await fileOps.delete(nextPath);
    return { ok: false, reason: 'corrupted' };
  }

  // 5+6. Diese kurze DB-/Dateiphase beginnt erst nach Download, Prüfsumme
  // und Integritätsprüfung. Eine Lifecycle-Reservierung bleibt dabei nicht
  // über die Vorbereitung oder den Netzwerkzugriff offen.
  throwIfOffDumpAborted(signal);
  await detachPersistentOffDump(db, signal);
  setOffDumpAttached(false);

  // 7. Aktive Datei (falls vorhanden) zu recovery umbenennen.
  throwIfOffDumpAborted(signal);
  if (await fileOps.exists(activePath)) {
    throwIfOffDumpAborted(signal);
    await fileOps.move(activePath, recoveryPath);
  }

  // 8. Neue Datei atomar aktivieren.
  throwIfOffDumpAborted(signal);
  await fileOps.move(nextPath, activePath);

  // 9. Neue Datei attachen.
  throwIfOffDumpAborted(signal);
  await attachPlaintextDatabase(db, activePath, 'off_dump', attachmentMode);
  setOffDumpAttached(true);

  // 10. Recovery-Datei erst NACH erfolgreichem Attach entfernen.
  throwIfOffDumpAborted(signal);
  if (await fileOps.exists(recoveryPath)) {
    throwIfOffDumpAborted(signal);
    await fileOps.delete(recoveryPath);
  }

  return { ok: true, dataVersion: inspected.dataVersion };
}
