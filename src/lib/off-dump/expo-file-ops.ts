import { File } from 'expo-file-system';

import type { SqlDatabase } from '@/lib/db/types';
import type { DumpInspection, FileOps } from './file-ops';
import { attachPlaintextDatabase } from './plaintext-attachment';

export function createExpoFileOps(db: SqlDatabase): FileOps {
  return {
    async exists(path: string): Promise<boolean> {
      return new File(path).exists;
    },

    async size(path: string): Promise<number> {
      return new File(path).size ?? 0;
    },

    async download(url: string, destPath: string): Promise<void> {
      await File.downloadFileAsync(url, new File(destPath), { idempotent: true });
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

      // Eindeutiger Alias pro Aufruf, da ATTACH/DETACH nicht als Einheit serialisiert werden.
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
