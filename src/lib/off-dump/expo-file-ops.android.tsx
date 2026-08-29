import { File } from 'expo-file-system';

import type { SqlDatabase } from '@/lib/db/types';
import type { DumpInspection, FileOps } from './file-ops';
import { attachPlaintextDatabase } from './plaintext-attachment';

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export function createExpoFileOps(db: SqlDatabase): FileOps {
  return {
    async exists(path: string): Promise<boolean> {
      return new File(toFileUri(path)).exists;
    },
    async size(path: string): Promise<number> {
      return new File(toFileUri(path)).size ?? 0;
    },
    async download(url: string, destPath: string): Promise<void> {
      await File.downloadFileAsync(url, new File(toFileUri(destPath)), { idempotent: true });
    },
    async move(fromPath: string, toPath: string): Promise<void> {
      new File(toFileUri(fromPath)).move(new File(toFileUri(toPath)));
    },
    async delete(path: string): Promise<void> {
      const file = new File(toFileUri(path));
      if (file.exists) file.delete();
    },
    async checksum(path: string): Promise<string> {
      const { md5 } = new File(toFileUri(path)).info({ md5: true });
      if (!md5) throw new Error(`Konnte MD5-Prüfsumme für ${path} nicht berechnen.`);
      return md5;
    },
    async inspectDump(path: string): Promise<DumpInspection | null> {
      if (!new File(toFileUri(path)).exists) return null;
      const alias = `off_dump_inspect_${Math.random().toString(36).slice(2)}`;
      try {
        await attachPlaintextDatabase(db, path, alias, 'sqlcipher');
      } catch {
        return null;
      }
      try {
        const meta = await db.getFirstAsync<{ schema_version: number; data_version: string }>(
          `select schema_version, data_version from ${alias}.dump_meta limit 1`,
        );
        if (!meta) return null;
        const check = await db.getFirstAsync<Record<string, string>>(`PRAGMA ${alias}.quick_check`);
        const integrityOk = check !== null && Object.values(check).some((value) => value === 'ok');
        return { schemaVersion: meta.schema_version, dataVersion: meta.data_version, integrityOk };
      } catch {
        return null;
      } finally {
        await db.execAsync(`DETACH DATABASE ${alias}`);
      }
    },
  };
}
