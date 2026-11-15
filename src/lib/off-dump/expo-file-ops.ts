import { File } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';

import { isSerializedSqlDatabase } from '@/lib/db/serialize';
import type { SqlDatabase } from '@/lib/db/types';
import {
  createOffDumpAbortError,
  type DumpInspection,
  type FileOps,
  throwIfOffDumpAborted,
} from './file-ops';
import { attachPlaintextDatabase } from './plaintext-attachment';

export function createExpoFileOps(db: SqlDatabase): FileOps {
  return {
    async exists(path: string): Promise<boolean> {
      return new File(path).exists;
    },

    async size(path: string): Promise<number> {
      return new File(path).size ?? 0;
    },

    async download(url: string, destPath: string, signal?: AbortSignal): Promise<void> {
      throwIfOffDumpAborted(signal);
      const download = LegacyFileSystem.createDownloadResumable(url, new File(destPath).uri, {
        sessionType: LegacyFileSystem.FileSystemSessionType.FOREGROUND,
      });
      const cancel = () => {
        void download.cancelAsync().catch(() => undefined);
      };
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        const result = await download.downloadAsync();
        throwIfOffDumpAborted(signal);
        if (!result) throw createOffDumpAbortError();
      } finally {
        signal?.removeEventListener('abort', cancel);
      }
    },

    async move(fromPath: string, toPath: string): Promise<void> {
      new File(fromPath).move(new File(toPath));
    },

    async delete(path: string): Promise<void> {
      const file = new File(path);
      if (file.exists) file.delete();
    },

    async checksum(path: string): Promise<string> {
      const { md5 } = new File(path).info({ md5: true });
      if (!md5) throw new Error(`Konnte MD5-Prüfsumme für ${path} nicht berechnen.`);
      return md5;
    },

    async inspectDump(path: string): Promise<DumpInspection | null> {
      if (!new File(path).exists) return null;

      const inspectWithCleanup = async (
        inspectionDb: SqlDatabase,
        cleanupExecAsync: (source: string) => Promise<void>,
      ): Promise<DumpInspection | null> => {
        // Eindeutiger Alias pro Aufruf. The serialized path keeps ATTACH and
        // DETACH in one writer scope so cleanup cannot reacquire after the
        // lifecycle admission closes.
        const alias = `off_dump_inspect_${Math.random().toString(36).slice(2)}`;
        try {
          await attachPlaintextDatabase(inspectionDb, path, alias, 'sqlcipher');
        } catch {
          return null;
        }

        let primaryError = false;
        let cleanupError: unknown;
        let result: DumpInspection | null = null;
        try {
          const meta = await inspectionDb.getFirstAsync<{
            schema_version: number;
            data_version: string;
          }>(`select schema_version, data_version from ${alias}.dump_meta limit 1`);
          if (meta) {
            const check = await inspectionDb.getFirstAsync<Record<string, string>>(
              `PRAGMA ${alias}.quick_check`,
            );
            const integrityOk =
              check !== null && Object.values(check).some((value) => value === 'ok');

            result = {
              schemaVersion: meta.schema_version,
              dataVersion: meta.data_version,
              integrityOk,
            };
          }
        } catch {
          primaryError = true;
        } finally {
          try {
            await cleanupExecAsync(`DETACH DATABASE ${alias}`);
          } catch (error) {
            cleanupError = error;
          }
        }

        if (!primaryError && cleanupError !== undefined) throw cleanupError;
        return result;
      };

      if (isSerializedSqlDatabase(db)) {
        return db.withWriterLeaseAsync('off.inspect', ({ db: scopedDb, cleanupExecAsync }) =>
          inspectWithCleanup(scopedDb, cleanupExecAsync),
        );
      }

      return inspectWithCleanup(db, (source) => db.execAsync(source));
    },
  };
}
